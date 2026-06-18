import { test, expect } from '@playwright/test';

test.describe('Mentor Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3001/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display mentor page', async ({ page }) => {
    // Navigate to mentor page
    await page.goto('http://localhost:3001/mentor');
    
    // Verify mentor page is loaded
    await expect(page.locator('text=Mentorship')).toBeVisible();
    
    // Verify mentors are displayed
    await expect(page.locator('[class*="mentor"]')).toBeVisible();
  });

  test('should view mentor details', async ({ page }) => {
    // Navigate to mentor page
    await page.goto('http://localhost:3001/mentor');
    
    // Wait for mentors to load
    await page.waitForSelector('[class*="mentor"]');
    
    // Click on a mentor
    await page.click('[class*="mentor"]:first-child');
    
    // Wait for mentor details to load
    await page.waitForTimeout(1000);
    
    // Verify mentor details are displayed
    await expect(page.locator('[class*="mentor-detail"]')).toBeVisible();
  });

  test('should book a mentoring session', async ({ page }) => {
    // Navigate to mentor page
    await page.goto('http://localhost:3001/mentor');
    
    // Wait for mentors to load
    await page.waitForSelector('[class*="mentor"]');
    
    // Click on a mentor
    await page.click('[class*="mentor"]:first-child');
    
    // Wait for mentor details to load
    await page.waitForTimeout(1000);
    
    // Click book session button
    await page.click('button:has-text("Book Session")');
    
    // Wait for booking form
    await page.waitForTimeout(1000);
    
    // Select a time slot
    await page.click('[class*="time-slot"]:first-child');
    
    // Fill booking form
    await page.fill('textarea[name="notes"]', 'I need help with React.');
    
    // Submit booking
    await page.click('button:has-text("Confirm Booking")');
    
    // Wait for booking confirmation
    await page.waitForTimeout(1000);
    
    // Verify booking is confirmed
    await expect(page.locator('text=Booking confirmed')).toBeVisible();
  });

  test('should search for mentors by specialty', async ({ page }) => {
    // Navigate to mentor page
    await page.goto('http://localhost:3001/mentor');
    
    // Wait for mentors to load
    await page.waitForSelector('[class*="mentor"]');
    
    // Search for mentors
    await page.fill('input[placeholder*="Search"]', 'React');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // Verify filtered mentors are displayed
    await expect(page.locator('[class*="mentor"]')).toBeVisible();
  });
});
