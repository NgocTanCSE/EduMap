#!/usr/bin/env python3
"""Test script for OverpassCrawler and OpenDataCrawler"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from overpass_crawler import OverpassCrawler
from open_data_crawler import OpenDataCrawler

print("=" * 60)
print("TEST 1: OverpassCrawler - Schools/Libraries/Universities")
print("=" * 60)
try:
    oc = OverpassCrawler()
    edu_data = oc.fetch_schools_libraries_universities()
    print(f"  Found {len(edu_data)} education POIs")
    for d in edu_data[:10]:
        print(f"  - {d['name']} | cat={d['category']} | lat={d['lat']}, lng={d['lng']}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 60)
print("TEST 2: OverpassCrawler - WiFi Hotspots")
print("=" * 60)
try:
    wifi_data = oc.fetch_wifi_hotspots()
    print(f"  Found {len(wifi_data)} WiFi POIs")
    for d in wifi_data[:10]:
        print(f"  - {d['name']} | cat={d['category']} | lat={d['lat']}, lng={d['lng']}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 60)
print("TEST 3: OverpassCrawler - Green Spaces")
print("=" * 60)
try:
    green_data = oc.fetch_green_spaces()
    print(f"  Found {len(green_data)} green space POIs")
    for d in green_data[:10]:
        print(f"  - {d['name']} | cat={d['category']} | lat={d['lat']}, lng={d['lng']}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 60)
print("TEST 4: OpenDataCrawler - Schools (truong-hoc)")
print("=" * 60)
try:
    od = OpenDataCrawler()
    schools = od.fetch_dataset("truong-hoc", default_category="school")
    print(f"  Found {len(schools)} school records")
    for d in schools[:5]:
        print(f"  - {d['name']} | lat={d['lat']}, lng={d['lng']}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 60)
print("TEST 5: OpenDataCrawler - WiFi (wifi-cong-cong)")
print("=" * 60)
try:
    wifi_od = od.fetch_dataset("wifi-cong-cong", default_category="wifi")
    print(f"  Found {len(wifi_od)} WiFi records")
    for d in wifi_od[:5]:
        print(f"  - {d['name']} | lat={d['lat']}, lng={d['lng']}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("=" * 60)
print("SUMMARY")
print("=" * 60)
