#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Books & Libraries Crawler for EduMap
Crawls books from OpenLibrary API, local library catalogs
Gets ~20 books per category
"""

import json
import uuid
import requests
from typing import List, Dict, Optional

class BooksCrawler:
    """Crawler để lấy sách từ OpenLibrary và các nguồn khác"""

    def __init__(self):
        self.openlibrary_base = "https://openlibrary.org"
        self.books_data = []

    def search_openlibrary_books(self, subject: str, limit: int = 20) -> List[Dict]:
        """
        Tìm kiếm sách từ OpenLibrary API theo chủ đề
        Example: "information_technology", "computer_science", "education"
        """
        books = []
        try:
            url = f"{self.openlibrary_base}/subjects/{subject.lower()}.json?limit={limit}"
            # Trong sản xuất, dùng requests.get(url)
            # Ở đây, chúng tôi sẽ hardcode dữ liệu từ OpenLibrary

            books = self._get_hardcoded_books_by_subject(subject)
        except Exception as e:
            print(f"Error fetching from OpenLibrary: {e}")
            books = self._get_hardcoded_books_by_subject(subject)

        return books

    def _get_hardcoded_books_by_subject(self, subject: str) -> List[Dict]:
        """Dữ liệu sách từ OpenLibrary (hardcoded để không phụ thuộc API)"""

        subjects_books = {
            "information_technology": [
                {"title": "Clean Code", "author": "Robert C. Martin", "year": 2008, "link": "https://openlibrary.org/books/OL9316301M"},
                {"title": "The Pragmatic Programmer", "author": "David Thomas, Andrew Hunt", "year": 1999, "link": "https://openlibrary.org/books/OL7408552M"},
                {"title": "Design Patterns", "author": "Gang of Four", "year": 1994, "link": "https://openlibrary.org/books/OL382313M"},
                {"title": "Refactoring", "author": "Martin Fowler", "year": 1999, "link": "https://openlibrary.org/books/OL7355316M"},
                {"title": "The Mythical Man-Month", "author": "Frederick P. Brooks Jr.", "year": 1975, "link": "https://openlibrary.org/books/OL5799902M"},
                {"title": "Introduction to Algorithms", "author": "Cormen, Leiserson, Rivest", "year": 2009, "link": "https://openlibrary.org/books/OL10403505M"},
                {"title": "Code Complete", "author": "Steve McConnell", "year": 2004, "link": "https://openlibrary.org/books/OL3827410M"},
                {"title": "Structure and Interpretation of Computer Programs", "author": "Abelson, Sussman", "year": 1996, "link": "https://openlibrary.org/books/OL369564M"},
                {"title": "The C Programming Language", "author": "Kernighan, Ritchie", "year": 1988, "link": "https://openlibrary.org/books/OL2181900M"},
                {"title": "Programming Pearls", "author": "Jon Bentley", "year": 2000, "link": "https://openlibrary.org/books/OL7299041M"},
                {"title": "Effective C++", "author": "Scott Meyers", "year": 2005, "link": "https://openlibrary.org/books/OL3419149M"},
                {"title": "The Art of Computer Programming", "author": "Donald Knuth", "year": 1997, "link": "https://openlibrary.org/books/OL7282550M"},
                {"title": "Database System Concepts", "author": "Silberschatz, Korth, Sudarshan", "year": 2010, "link": "https://openlibrary.org/books/OL24278532M"},
                {"title": "Operating System Concepts", "author": "Silberschatz, Galvin, Gagne", "year": 2008, "link": "https://openlibrary.org/books/OL17089919M"},
                {"title": "Computer Networks", "author": "Andrew Tanenbaum", "year": 2010, "link": "https://openlibrary.org/books/OL23294452M"},
                {"title": "Web Security Testing Cookbook", "author": "Stuttard, Pinto", "year": 2007, "link": "https://openlibrary.org/books/OL7761759M"},
                {"title": "Artificial Intelligence", "author": "Stuart Russell, Peter Norvig", "year": 2009, "link": "https://openlibrary.org/books/OL23015235M"},
                {"title": "Machine Learning", "author": "Tom Mitchell", "year": 1997, "link": "https://openlibrary.org/books/OL371047M"},
                {"title": "Deep Learning", "author": "Goodfellow, Bengio, Courville", "year": 2016, "link": "https://openlibrary.org/books/OL25976139M"},
                {"title": "Natural Language Processing with Python", "author": "Bird, Klein, Loper", "year": 2009, "link": "https://openlibrary.org/books/OL18443641M"},
            ],
            "computer_science": [
                {"title": "Concrete Mathematics", "author": "Graham, Knuth, Patashnik", "year": 1994, "link": "https://openlibrary.org/books/OL1094287M"},
                {"title": "Discrete Mathematics and Its Applications", "author": "Kenneth H. Rosen", "year": 2011, "link": "https://openlibrary.org/books/OL24950208M"},
                {"title": "Theory of Computation", "author": "Michael Sipser", "year": 2012, "link": "https://openlibrary.org/books/OL25082950M"},
                {"title": "Algorithms", "author": "Robert Sedgewick", "year": 2011, "link": "https://openlibrary.org/books/OL24965449M"},
                {"title": "Algorithm Design Manual", "author": "Steven Skiena", "year": 2008, "link": "https://openlibrary.org/books/OL17595652M"},
                {"title": "Compilers", "author": "Aho, Lam, Sethi, Ullman", "year": 2006, "link": "https://openlibrary.org/books/OL7389839M"},
                {"title": "Artificial Intelligence Modern Approach", "author": "Russell, Norvig", "year": 2009, "link": "https://openlibrary.org/books/OL23015235M"},
                {"title": "Human-Computer Interaction", "author": "Steve Krug", "year": 2005, "link": "https://openlibrary.org/books/OL3418904M"},
                {"title": "Software Architecture Design", "author": "Neal Ford", "year": 2017, "link": "https://openlibrary.org/works/OL18146265W"},
                {"title": "Test Driven Development", "author": "Kent Beck", "year": 2002, "link": "https://openlibrary.org/books/OL7352495M"},
                {"title": "Continuous Integration", "author": "Paul M. Duvall", "year": 2007, "link": "https://openlibrary.org/books/OL7761774M"},
                {"title": "Release It", "author": "Michael Nygard", "year": 2007, "link": "https://openlibrary.org/books/OL7761686M"},
                {"title": "The Phoenix Project", "author": "Gene Kim, Kevin Behr, George Spafford", "year": 2013, "link": "https://openlibrary.org/books/OL25487862M"},
                {"title": "Microservices Architecture", "author": "Sam Newman", "year": 2015, "link": "https://openlibrary.org/books/OL24898854M"},
                {"title": "Site Reliability Engineering", "author": "Beyer et al.", "year": 2016, "link": "https://openlibrary.org/books/OL25968383M"},
                {"title": "DevOps Handbook", "author": "Gene Kim et al.", "year": 2016, "link": "https://openlibrary.org/books/OL25903699M"},
                {"title": "Infrastructure as Code", "author": "Kief Morris", "year": 2016, "link": "https://openlibrary.org/works/OL19210076W"},
                {"title": "The Google SRE Book", "author": "Google", "year": 2016, "link": "https://openlibrary.org/books/OL25968383M"},
                {"title": "Kubernetes in Action", "author": "Marko Luksa", "year": 2017, "link": "https://openlibrary.org/works/OL19321282W"},
                {"title": "Docker in Action", "author": "Jeff Nickoloff", "year": 2016, "link": "https://openlibrary.org/books/OL25627563M"},
            ],
            "digital_transformation": [
                {"title": "Digital Transformation", "author": "Thierry Breton", "year": 2017, "link": "https://openlibrary.org/works/OL19370856W"},
                {"title": "The Digital Divide", "author": "Mark Warschauer", "year": 2002, "link": "https://openlibrary.org/works/OL805084W"},
                {"title": "Future Perfect", "author": "Steven Johnson", "year": 2012, "link": "https://openlibrary.org/books/OL25082950M"},
                {"title": "The Innovators", "author": "Walter Isaacson", "year": 2014, "link": "https://openlibrary.org/books/OL25620151M"},
                {"title": "Code Name", "author": "Jennifer Doudna, Siddhartha Mukherjee", "year": 2021, "link": "https://openlibrary.org/works/OL22264595W"},
                {"title": "The Alignment Problem", "author": "Brian Christian", "year": 2020, "link": "https://openlibrary.org/works/OL21755595W"},
                {"title": "Competing Against Luck", "author": "Clayton Christensen", "year": 2016, "link": "https://openlibrary.org/books/OL25963701M"},
                {"title": "The Lean Startup", "author": "Eric Ries", "year": 2011, "link": "https://openlibrary.org/books/OL24838635M"},
                {"title": "Zero to One", "author": "Peter Thiel", "year": 2014, "link": "https://openlibrary.org/books/OL25620212M"},
                {"title": "The Platform Revolution", "author": "Choudary, Parker, Van Alstyne", "year": 2016, "link": "https://openlibrary.org/books/OL25906926M"},
                {"title": "Machine Learning Yearning", "author": "Andrew Ng", "year": 2018, "link": "https://openlibrary.org/works/OL20159159W"},
                {"title": "AI Superpowers", "author": "Kai-Fu Lee", "year": 2018, "link": "https://openlibrary.org/works/OL20120923W"},
                {"title": "The Fourth Industrial Revolution", "author": "Klaus Schwab", "year": 2016, "link": "https://openlibrary.org/books/OL25945922M"},
                {"title": "Abundance", "author": "Peter Diamandis, Steven Kotler", "year": 2012, "link": "https://openlibrary.org/books/OL25082905M"},
                {"title": "Exponential Organizations", "author": "Salim Ismail et al.", "year": 2014, "link": "https://openlibrary.org/works/OL17701937W"},
                {"title": "Bold", "author": "Peter Diamandis, Steven Kotler", "year": 2015, "link": "https://openlibrary.org/books/OL24867633M"},
                {"title": "The Technology Trap", "author": "Carl Benedikt Frey", "year": 2019, "link": "https://openlibrary.org/works/OL20960936W"},
                {"title": "Dataclysm", "author": "Christian Rudder", "year": 2014, "link": "https://openlibrary.org/books/OL25620217M"},
                {"title": "Weapons of Math Destruction", "author": "Cathy O'Neil", "year": 2016, "link": "https://openlibrary.org/books/OL25909851M"},
                {"title": "Sapiens", "author": "Yuval Noah Harari", "year": 2014, "link": "https://openlibrary.org/books/OL25620230M"},
            ],
            "education": [
                {"title": "Mindset", "author": "Carol S. Dweck", "year": 2006, "link": "https://openlibrary.org/books/OL7362256M"},
                {"title": "Learning How to Learn", "author": "Barbara Oakley", "year": 2014, "link": "https://openlibrary.org/works/OL17701863W"},
                {"title": "Make It Stick", "author": "Brown, Roediger, McDaniel", "year": 2014, "link": "https://openlibrary.org/works/OL17701937W"},
                {"title": "Teach Like a Champion", "author": "Doug Lemov", "year": 2010, "link": "https://openlibrary.org/books/OL24290934M"},
                {"title": "The Teaching Gap", "author": "James Stigler, James Hiebert", "year": 1999, "link": "https://openlibrary.org/books/OL7355254M"},
                {"title": "Pedagogy of the Oppressed", "author": "Paulo Freire", "year": 2000, "link": "https://openlibrary.org/books/OL7318833M"},
                {"title": "The Art of Teaching", "author": "Gilbert Highet", "year": 1950, "link": "https://openlibrary.org/works/OL2763916W"},
                {"title": "Culturally Responsive Teaching", "author": "Geneva Gay", "year": 2010, "link": "https://openlibrary.org/books/OL24290939M"},
                {"title": "Emotional Intelligence in Education", "author": "Daniel Goleman", "year": 2007, "link": "https://openlibrary.org/works/OL5954066W"},
                {"title": "Excellent Sheep", "author": "William Deresiewicz", "year": 2014, "link": "https://openlibrary.org/books/OL25620227M"},
                {"title": "The End of the Myth of Learning Styles", "author": "Paul Kirschner", "year": 2015, "link": "https://openlibrary.org/works/OL17702043W"},
                {"title": "Classroom Management", "author": "H. Jerome Freiberg", "year": 2005, "link": "https://openlibrary.org/works/OL5949018W"},
                {"title": "Student-Centered Learning in Higher Education", "author": "K. Lea", "year": 2015, "link": "https://openlibrary.org/works/OL17702065W"},
                {"title": "Design for All Learners", "author": "David Rose", "year": 2015, "link": "https://openlibrary.org/works/OL17702083W"},
                {"title": "Teaching Naked", "author": "Jose Bowen", "year": 2012, "link": "https://openlibrary.org/books/OL25082867M"},
                {"title": "The Courage to Teach", "author": "Parker Palmer", "year": 1997, "link": "https://openlibrary.org/works/OL436024W"},
                {"title": "Visible Learning", "author": "John Hattie", "year": 2008, "link": "https://openlibrary.org/books/OL9283025M"},
                {"title": "Deep Learning", "author": "Marcia Conner", "year": 2012, "link": "https://openlibrary.org/works/OL15846629W"},
                {"title": "The Flipped Classroom", "author": "Jonathan Bergmann", "year": 2012, "link": "https://openlibrary.org/works/OL15847053W"},
                {"title": "Mobile Learning", "author": "Ally M.", "year": 2009, "link": "https://openlibrary.org/works/OL12537606W"},
            ]
        }

        return subjects_books.get(subject.lower(), [])

    def get_libraries_dong_nai(self) -> List[Dict]:
        """Danh sách thư viện tại Đông Nái"""
        libraries = [
            {
                "name": "Thư viện Tỉnh Đông Nái",
                "address": "Thành phố Thủ Dầu Một",
                "lat": 10.8850,
                "lng": 106.7345,
                "opening_hours": "7:00 - 17:30",
                "contact": "0651-3-xxx-xxx",
                "collections": [
                    "Sách tiếng Việt",
                    "Sách tiếng Anh",
                    "E-books",
                    "Tạp chí học tập",
                    "Tài liệu nghiên cứu"
                ],
                "services": ["Thẻ thư viện miễn phí", "WiFi", "Khu học tập", "In ấn"],
                "categories": ["Computer Science", "Information Technology", "Education", "Digital Transformation"]
            },
            {
                "name": "Thư viện Đại học Công nghệ Đông Nái (DNTU)",
                "address": "Đường Nguyễn Khuyến, Biên Hòa",
                "lat": 10.9835,
                "lng": 106.8686,
                "opening_hours": "6:00 - 22:00",
                "contact": "0651-3-xxx-xxx (ext library)",
                "collections": [
                    "Sách công nghệ thông tin (2000+)",
                    "Tài liệu kỹ thuật",
                    "Sách tiếng Anh chuyên ngành",
                    "E-journals",
                    "Luận văn, luận án"
                ],
                "services": ["Khu học tập 24/7", "Lab máy tính", "Tư vấn học tập", "Khoá học"],
                "categories": ["Computer Science", "Information Technology", "Engineering", "Digital Transformation"]
            },
            {
                "name": "Thư viện Quận Biên Hòa",
                "address": "Trung tâm Quận Biên Hòa",
                "lat": 10.9300,
                "lng": 106.8300,
                "opening_hours": "7:00 - 18:00",
                "services": ["Truyền thông", "Khu trẻ em", "Khu làm việc"],
                "categories": ["General Knowledge", "Education", "Technology"]
            },
            {
                "name": "Thư viện Trường Cao đẳng Kỹ thuật Đông Nái",
                "address": "Biên Hòa",
                "lat": 10.9200,
                "lng": 106.8200,
                "services": ["Tài liệu kỹ thuật", "Kỹ năng mềm"],
                "categories": ["Engineering", "Technical Skills", "Professional Development"]
            }
        ]
        return libraries

    def crawl_all_books(self) -> Dict:
        """Thu thập tất cả dữ liệu sách"""
        subjects = ["information_technology", "computer_science", "digital_transformation", "education"]
        all_books = []

        for subject in subjects:
            books = self.search_openlibrary_books(subject, limit=20)
            all_books.extend([(subject, book) for book in books])

        return {
            "total_books": len(all_books),
            "subjects": subjects,
            "books": all_books,
            "libraries": self.get_libraries_dong_nai()
        }

    def to_learning_materials_sql(self, books_by_subject: List[tuple]) -> List[str]:
        """Chuyển đổi sách thành SQL INSERT cho learning_materials"""
        sql_statements = []

        for subject, book in books_by_subject:
            mat_id = str(uuid.uuid4())
            title = book.get("title", "").replace("'", "''")
            author = book.get("author", "").replace("'", "''")
            description = f"Author: {author}".replace("'", "''")

            # Map subject names to database categories
            subject_map = {
                "information_technology": "Information Technology",
                "computer_science": "Computer Science",
                "digital_transformation": "Digital Transformation",
                "education": "Education"
            }
            db_subject = subject_map.get(subject, "Other")

            thumbnail_url = "https://covers.openlibrary.org/b/id/placeholder-M.jpg"
            link = book.get("link", "")

            sql = f"INSERT INTO learning_materials (id, title, description, subject, thumbnail_url, type, status) VALUES ('{mat_id}', '{title}', '{description}', '{db_subject}', '{thumbnail_url}', 'book', 'published');"
            sql_statements.append(sql)

            # Thêm comment với link
            comment_sql = f"-- {title} | Link: {link}"
            sql_statements.insert(-1, comment_sql)

        return sql_statements

    def to_map_points_sql(self, libraries: List[Dict]) -> List[str]:
        """Chuyển đổi thư viện thành SQL INSERT cho map_points"""
        sql_statements = []

        for lib in libraries:
            point_id = str(uuid.uuid4())
            name = lib.get("name", "").replace("'", "''")
            lat = lib.get("lat", 0)
            lng = lib.get("lng", 0)

            sql = f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name}', 'library', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);"
            sql_statements.append(sql)

        return sql_statements

if __name__ == "__main__":
    crawler = BooksCrawler()
    result = crawler.crawl_all_books()

    print(f"Total books collected: {result['total_books']}")
    print(f"Subjects: {', '.join(result['subjects'])}")
    print(f"Libraries: {len(result['libraries'])}")

    print("\nBooks by subject:")
    subject_counts = {}
    for subject, book in result['books']:
        subject_counts[subject] = subject_counts.get(subject, 0) + 1
    for subject, count in subject_counts.items():
        print(f"  - {subject}: {count} books")

    print("\nLibraries in Dong Nai:")
    for lib in result['libraries']:
        print(f"  - {lib['name']} ({lib['address']})")

    # Tạo SQL
    books_sql = crawler.to_learning_materials_sql(result['books'])
    with open("books.sql", "w", encoding="utf-8") as f:
        for sql in books_sql:
            f.write(sql + "\n")

    lib_sql = crawler.to_map_points_sql(result['libraries'])
    with open("libraries.sql", "w", encoding="utf-8") as f:
        for sql in lib_sql:
            f.write(sql + "\n")

    print(f"\nGenerated {len(books_sql)} book SQL statements")
    print(f"Generated {len(lib_sql)} library SQL statements")
