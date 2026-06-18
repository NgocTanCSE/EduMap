import { test, expect } from '@playwright/test';

test.describe('Map Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3001/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display map page', async ({ page }) => {
    // Navigate to map page
    await page.goto('http://localhost:3001/map');
    
    // Verify map is loaded
    await expect(page.locator('[class*="leaflet"]')).toBeVisible();
    
    // Verify sidebar is visible
    await expect(page.locator('text=Locations')).toBeVisible();
  });

  test('should search for locations', async ({ page }) => {
    // Navigate to map page
    await page.goto('http://localhost:3001/map');
    
    // Wait for map to load
    await page.waitForSelector('[class*="leaflet"]');
    
    // Search for a location
    await page.fill('input[placeholder*="Search"]', 'library');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // Verify search results are displayed
    await expect(page.locator('[class*="search-result"]')).toBeVisible();
  });

  test('should filter by category', async ({ page }) => {
    // Navigate to map page
    await page.goto('http://localhost:3001/map');
    
    // Wait for map to load
    await page.waitForSelector('[class*="leaflet"]');
    
    // Click on category filter
    await page.click('button:has-text("Schools")');
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Verify filtered results are displayed
    await expect(page.locator('[class*="filtered-marker"]')).toBeVisible();
  });

  test('should view location details', async ({ page }) => {
    // Navigate to map page
    await page.goto('http://localhost:3001/map');
    
    // Wait for map to load
    await page.waitForSelector('[class*="leaflet"]');
    
    // Click on a location marker
    await page.click('[class*="marker"]:first-child');
    
    // Wait for detail panel to open
    await page.waitForTimeout(1000);
    
    // Verify location details are displayed
    await expect(page.locator('[class*="location-detail"]')).toBeVisible();
  });
});
