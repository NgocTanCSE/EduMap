import React from 'react';

export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-yellow-600 focus:text-white focus:rounded-lg focus:shadow-lg"
    >
      Chuyển đến nội dung chính
    </a>
  );
}
