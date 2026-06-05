import { Injectable, NotFoundException } from '@nestjs/common';

export interface LibraryItem {
  id: string;
  title: string;
  author: string;
  type: 'book' | 'article' | 'video';
  url: string;
}

@Injectable()
export class LibraryService {
  private items: LibraryItem[] = []; // In-memory mock data

  constructor() {
    this.items.push({ id: 'lib1', title: 'Python Basics', author: 'John Doe', type: 'book', url: 'http://example.com/python' });
    this.items.push({ id: 'lib2', title: 'Data Structures Explained', author: 'Jane Smith', type: 'video', url: 'http://example.com/ds-video' });
  }

  async findAll(): Promise<LibraryItem[]> {
    // In a real app, this would fetch data from a database
    return this.items;
  }

  async findOne(id: string): Promise<LibraryItem> {
    // In a real app, this would fetch data from a database
    const item = this.items.find(i => i.id === id);
    if (!item) {
      throw new NotFoundException(`Library item with ID "${id}" not found`);
    }
    return item;
  }

  async create(item: Omit<LibraryItem, 'id'>): Promise<LibraryItem> {
    const newItem = { id: `lib${this.items.length + 1}`, ...item };
    this.items.push(newItem);
    // In a real app, this would save to the database
    return newItem;
  }
}
