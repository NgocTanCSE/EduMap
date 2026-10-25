from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import re
import logging

router = APIRouter(prefix="/api/ai/pdf", tags=["7. PDF Transcript Reader"])

logger = logging.getLogger("pdf_transcript")


def _extract_text_pypdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using pypdf (lightweight, no heavy deps)."""
    from pypdf import PdfReader
    import io

    reader = PdfReader(io.BytesIO(file_bytes))
    texts = []
    for page_num, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
            if text.strip():
                texts.append(f"[Trang {page_num + 1}]\n{text}")
        except Exception as e:
            logger.warning(f"Error extracting page {page_num}: {e}")
            texts.append(f"[Trang {page_num + 1}: lỗi trích xuất]")
    return "\n".join(texts)


def _parse_transcript(text: str) -> dict:
    """Parse academic transcript text to extract GPA, courses, and grades.

    Handles common Vietnamese transcript formats (bảng điểm Đại học).
    Uses regex heuristics — does not require a fixed template.
    """
    result = {
        "gpa": None,
        "gpa_4_scale": None,
        "courses": [],
        "overall_grade": None,
        "student_name": None,
        "student_id": None,
        "program": None,
        "semester": None,
        "raw_text_length": len(text),
    }

    # ——— Student name ———
    # Tìm tên sau "Họ và tên" hoặc "Tên sinh viên"
    name_match = re.search(
        r"(?:Họ\s*và\s*tên|Tên sinh viên|Name)\s*[:\s]\s*([A-ZÀ-ỖƯỶ-Ỹ\s]{3,30})",
        text, re.IGNORECASE
    )
    if name_match:
        result["student_name"] = name_match.group(1).strip()

    # ——— Student ID ———
    id_match = re.search(
        r"(?:Mã\s*sinhviên|MSSV|Student ID|MaSV|ID)\s*[:\s]\s*(\w[\w\-]*)",
        text, re.IGNORECASE
    )
    if id_match:
        result["student_id"] = id_match.group(1).strip()

    # ——— Program / Ngành ———
    program_match = re.search(
        r"(?:Ngành|Chuyên ngành|Program|Major)\s*[:\s]\s*(.{3,50})",
        text, re.IGNORECASE
    )
    if program_match:
        result["program"] = program_match.group(1).strip()

    # ——— Semester / Học kỳ ———
    sem_match = re.search(
        r"(?:Học kỳ|Semester|Học kì)\s*[:\s]\s*(.+)",
        text, re.IGNORECASE
    )
    if sem_match:
        result["semester"] = sem_match.group(1).strip()

    # ——— GPA / Điểm trung bình ———
    # Common patterns: "Điểm TB: 3.45/4.0" or "GPA: 3.45" or "Trung bình: 3.45"
    gpa_4_match = re.search(
        r"(?:GPA|Điểm\s*TB|Trung\s*bình|TBTK)\s*[:\s]\s*(\d{1,2}[.,]\d{2})\s*[/\(]?\s*(\d\.\d)?",
        text, re.IGNORECASE
    )
    if gpa_4_match:
        gpa_str = gpa_4_match.group(1).replace(",", ".")
        try:
            result["gpa"] = float(gpa_str)
            scale = gpa_4_match.group(2)
            if scale:
                result["gpa_4_scale"] = scale.replace(",", ".")
        except ValueError:
            pass

    # Vietnamese 10-point GPA: "Điểm TB hệ 10: 8.25"
    gpa_10_match = re.search(
        r"(?:Điểm\s*TB\s*hệ\s*10|TB\s*\(10\)|Trung\s*bình\s*hệ\s*10)\s*[:\s]\s*(\d{1,2}[.,]\d{2})",
        text, re.IGNORECASE
    )
    if gpa_10_match and result["gpa"] is None:
        try:
            result["gpa"] = float(gpa_10_match.group(1).replace(",", "."))
            result["gpa_4_scale"] = "4.0"
        except ValueError:
            pass

    # ——— Courses table ———
    # Lines like: "Mã MH | Tên môn học | TC | Điểm TH | Điểm CK | Điểm TK | DD"
    # Or: "Course Code | Course Name | Credits | Grade"
    lines = text.split("\n")
    for line in lines:
        # Try to match a course row with grade
        course_match = re.match(
            r"^\s*(\w[\w\-/]{3,15})\s+(.{3,50}?)\s+(\d+)\s+[\d,]*\s+[\d,]*\s+([\d,]*)\s*(\(?[^\)]+\)?)?$",
            line.strip()
        )
        if course_match:
            code = course_match.group(1).strip()
            name = course_match.group(2).strip()
            credits = int(course_match.group(3))
            grade_str = course_match.group(4).replace(",", ".")
            try:
                grade = float(grade_str)
                if grade > 10:  # Might be percentage
                    grade = grade / 10
            except ValueError:
                grade = None
            result["courses"].append({
                "code": code,
                "name": name,
                "credits": credits,
                "grade": grade,
                "grade_raw": grade_str,
            })

    # If no courses parsed from table format, look for simple "Subject: Grade" patterns
    if not result["courses"]:
        # Pattern: "Tên môn: 3.5" or "Subject - Grade"
        subject_match = re.findall(
            r"([A-ZÀ-ỖƯỶ][a-zà-ỗươỷỷêế\s]{2,30})\s*[:\-]\s*(\d{1,2}[.,]\d{1,2}|\d{1,2})",
            text
        )
        for name, grade_str in subject_match:
            grade_val = float(grade_str.replace(",", "."))
            if grade_val > 10:
                grade_val = grade_val / 10
            result["courses"].append({
                "code": "",
                "name": name.strip(),
                "credits": 0,
                "grade": grade_val,
                "grade_raw": grade_str,
            })

    result["courses"] = result["courses"][:50]  # Cap at 50 courses

    # ——— Overall grade classification ———
    if result["gpa"] is not None:
        if result["gpa"] >= 3.6:
            result["overall_grade"] = "Giỏi"
        elif result["gpa"] >= 3.0:
            result["overall_grade"] = "Khá"
        elif result["gpa"] >= 2.0:
            result["overall_grade"] = "Trung bình"
        else:
            result["overall_grade"] = "Yếu"

    return result


@router.post("/transcript")
async def extract_transcript(file: UploadFile = File(...)):
    """Trích xuất và phân tích bảng điểm từ file PDF.

    - Hỗ trợ format PDF text-based (scanned PDF cần OCR riêng)
    - Trả về GPA, danh sách môn học + điểm, xếp loại học lực
    - Dùng cho đánh giá học bổng thông minh
    """
    if not file:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp file PDF.")

    if not file.content_type or "pdf" not in file.content_type:
        raise HTTPException(status_code=400, detail="File phải là định dạng PDF.")

    try:
        file_bytes = await file.read()
        if len(file_bytes) > 10 * 1024 * 1024:  # 10 MB limit
            raise HTTPException(status_code=413, detail="File PDF quá lớn (giới hạn 10MB).")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi đọc file: {str(e)}")

    try:
        text = _extract_text_pypdf(file_bytes)
    except ImportError:
        # Fallback: basic PDF text extraction without pypdf
        text = _extract_text_fallback(file_bytes)
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Không thể trích xuất PDF: {str(e)}")

    if not text.strip():
        return JSONResponse({
            "status": "warning",
            "message": "Không tìm thấy văn bản trong PDF. File có thể là PDF quét (scan) cần OCR.",
            "extracted_text": "",
            "parsed": None,
        })

    parsed = _parse_transcript(text)

    return {
        "status": "success",
        "message": "Trích xuất và phân tích bảng điểm thành công.",
        "extracted_text": text[:5000] + ("..." if len(text) > 5000 else ""),
        "parsed": parsed,
    }


def _extract_text_fallback(file_bytes: bytes) -> str:
    """Basic PDF text extraction without pypdf — parses raw PDF content streams.

    Only extracts text from uncompressed content streams. Used as a last-resort
    fallback when pypdf is not installed.
    """
    import zlib
    try:
        raw = file_bytes.decode("latin-1", errors="replace")
    except Exception:
        raw = file_bytes.decode("utf-8", errors="replace")

    # Find stream objects and decompress them
    text_fragments = []
    idx = 0
    while True:
        stream_start = raw.find("stream", idx)
        if stream_start == -1:
            break
        # Skip to actual stream content (after "stream\n" or "stream\r\n")
        stream_content_start = stream_start + len("stream")
        if raw[stream_content_start:stream_content_start + 2] in ("\r\n", "\n"):
            stream_content_start += 2 if raw[stream_content_start:stream_content_start + 2] == "\r\n" else 1
        elif raw[stream_content_start:stream_content_start + 1] == "\n":
            stream_content_start += 1

        stream_end = raw.find("endstream", stream_content_start)
        if stream_end == -1:
            break

        stream_data = raw[stream_content_start:stream_end]
        try:
            decompressed = zlib.decompress(stream_data)
            # Extract text between parentheses (PDF text operators: (text) Tj or (text) ')
            texts = re.findall(r"\(([^)]+)\)", decompressed.decode("latin-1", errors="replace"))
            text_fragments.extend(texts)
        except Exception:
            pass

        idx = stream_end + len("endstream")

    return " ".join(text_fragments)
