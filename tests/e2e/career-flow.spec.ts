import { test, expect } from '@playwright/test';

test.describe('Career Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3001/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display career dashboard', async ({ page }) => {
    // Navigate to career page
    await page.goto('http://localhost:3001/career');
    
    // Verify career dashboard is loaded
    await expect(page.locator('text=Career Development')).toBeVisible();
    
    // Verify career paths are displayed
    await expect(page.locator('[class*="career-path"]')).toBeVisible();
  });

  test('should view career path details', async ({ page }) => {
    // Navigate to career page
    await page.goto('http://localhost:3001/career');
    
    // Click on a career path
    await page.click('[class*="career-path"]:first-child');
    
    // Wait for detail page to load
    await page.waitForTimeout(1000);
    
    // Verify career path details are displayed
    await expect(page.locator('[class*="career-detail"]')).toBeVisible();
  });

  test('should search for jobs', async ({ page }) => {
    // Navigate to jobs page
    await page.goto('http://localhost:3001/career/jobs');
    
    // Search for jobs
    await page.fill('input[placeholder*="Search"]', 'developer');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // Verify job listings are displayed
    await expect(page.locator('[class*="job-listing"]')).toBeVisible();
  });

  test('should apply for a job', async ({ page }) => {
    // Navigate to jobs page
    await page.goto('http://localhost:3001/career/jobs');
    
    // Click on a job listing
    await page.click('[class*="job-listing"]:first-child');
    
    // Wait for job details to load
    await page.waitForTimeout(1000);
    
    // Click apply button
    await page.click('button:has-text("Apply")');
    
    // Wait for application form
    await page.waitForTimeout(1000);
    
    // Verify application form is displayed
    await expect(page.locator('text=Apply for this position')).toBeVisible();
  });
});
