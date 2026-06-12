import json
import pathlib
import datasets

class DongNaiEducation(datasets.GeneratorBasedBuilder):
    """Dataset Dong Nai Education & Facilities (schools, universities, libraries, wifi)."""

    VERSION = datasets.Version("1.0.0")

    def _info(self):
        return datasets.DatasetInfo(
            description="Các trường học, đại học, thư viện và điểm Wi‑Fi ở tỉnh Đồng Nai",
            features=datasets.Features(
                {
                    "name": datasets.Value("string"),
                    "category": datasets.Value("string"),
                    "type": datasets.Value("string"),
                    "lat": datasets.Value("float64"),
                    "lng": datasets.Value("float64"),
                    "address": datasets.Value("string"),
                    "website": datasets.Value("string"),
                    "phone": datasets.Value("string"),
                    "operator": datasets.Value("string"),
                    "opening_hours": datasets.Value("string"),
                    "description": datasets.Value("string"),
                }
            ),
            homepage="https://huggingface.co/datasets/username/dongnai-education",
            license="cc-by-sa-4.0",
        )

    def _split_generators(self, dl_manager):
        # Các file JSON đều đã có trong repo, không cần download.
        json_path = dl_manager.download_and_extract("dongnai_detailed.json")
        return [datasets.SplitGenerator(name=datasets.Split.TRAIN, gen_kwargs={"filepath": json_path})]

    def _generate_examples(self, filepath):
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
        # Merge three sections into a flat list.
        for entry in data.get("schools", []):
            yield entry["name"], {
                "name": entry.get("name", ""),
                "category": "school",
                "type": entry.get("type", ""),
                "lat": entry.get("lat"),
                "lng": entry.get("lng"),
                "address": entry.get("address", ""),
                "website": entry.get("website", ""),
                "phone": entry.get("phone", ""),
                "operator": entry.get("operator", ""),
                "opening_hours": entry.get("opening_hours", ""),
                "description": entry.get("level", ""),
            }
        for entry in data.get("libraries", []):
            yield entry["name"], {
                "name": entry.get("name", ""),
                "category": "library",
                "type": entry.get("type", ""),
                "lat": entry.get("lat"),
                "lng": entry.get("lng"),
                "address": entry.get("address", ""),
                "website": entry.get("website", ""),
                "phone": entry.get("phone", ""),
                "operator": entry.get("operator", ""),
                "opening_hours": entry.get("opening_hours", ""),
                "description": "",
            }
        for entry in data.get("wifi", []):
            yield entry["name"], {
                "name": entry.get("name", ""),
                "category": "wifi",
                "type": entry.get("type", ""),
                "lat": entry.get("lat"),
                "lng": entry.get("lng"),
                "address": "",
                "website": "",
                "phone": "",
                "operator": "",
                "opening_hours": "",
                "description": "",
            }
