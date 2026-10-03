// Mock data for EduMap library / learning materials
// Used by the test-app mock server — NOT in production Docker/HF deployment.

export interface MockLibraryResource {
  id: string;
  title: string;
  author: string;
  subject: string;
  type: 'book' | 'course' | 'video' | 'article';
  thumbnail_url: string;
  description: string;
  status: 'published' | 'draft';
}

export const mockLibrary = {
  resources: [
    {
      id: 'book-001',
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      subject: 'Information Technology',
      type: 'book' as const,
      thumbnail_url: 'https://covers.openlibrary.org/b/id/4861873-L.jpg',
      description: 'A handbook of agile software craftsmanship with practical advice for writing clean code.',
      status: 'published' as const,
    },
    {
      id: 'book-002',
      title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
      author: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
      subject: 'Computer Science',
      type: 'book' as const,
      thumbnail_url: 'https://covers.openlibrary.org/b/id/4861873-L.jpg',
      description: 'The definitive guide to design patterns in software development.',
      status: 'published' as const,
    },
    {
      id: 'book-003',
      title: 'The Lean Startup',
      author: 'Eric Ries',
      subject: 'Digital Transformation',
      type: 'book' as const,
      thumbnail_url: 'https://covers.openlibrary.org/b/id/4861873-L.jpg',
      description: 'How today\'s entrepreneurs use continuous innovation to create successful startups.',
      status: 'published' as const,
    },
  ] as MockLibraryResource[],

  search(query: string): MockLibraryResource[] {
    if (!query) return mockLibrary.resources;
    const lower = query.toLowerCase();
    return mockLibrary.resources.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        r.author.toLowerCase().includes(lower) ||
        r.subject.toLowerCase().includes(lower) ||
        r.description.toLowerCase().includes(lower)
    );
  },
};
