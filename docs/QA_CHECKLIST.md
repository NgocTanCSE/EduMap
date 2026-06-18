# EduMap QA Checklist

## Tổng quan

Danh sách kiểm tra chất lượng trước khi deploy EduMap.

## 1. Frontend Pages

### Authentication Pages
- [ ] `/auth` - Redirects to `/auth/login`
- [ ] `/auth/login` - Login form works correctly
- [ ] `/auth/register` - Registration form works correctly
- [ ] `/auth/forgot-password` - Password reset works

### Core Pages
- [ ] `/` - Home page loads correctly
- [ ] `/dashboard` - Dashboard displays user data
- [ ] `/map` - Map loads with markers
- [ ] `/ai-chat` - AI chat interface works
- [ ] `/profile` - User profile displays correctly
- [ ] `/notifications` - Notifications load correctly
- [ ] `/leaderboard` - Leaderboard displays correctly

### Career Module
- [ ] `/career` - Career dashboard loads
- [ ] `/career/profile` - Career profile works
- [ ] `/career/quiz` - Career quiz works
- [ ] `/career/roadmap` - Roadmap generator works
- [ ] `/career/predictive` - Predictions display
- [ ] `/career/jobs` - Job listings load
- [ ] `/career/jobs/[id]` - Job details load

### Community Pages
- [ ] `/community` - Community feed loads
- [ ] `/community/post/[id]` - Post details load

### Library
- [ ] `/library` - Library resources load

### Events
- [ ] `/events` - Event listings load
- [ ] `/events/[id]` - Event details load

### Scholarships
- [ ] `/scholarships` - Scholarship listings load

### Mentor
- [ ] `/mentor` - Mentor listings load
- [ ] `/mentor/[id]` - Mentor details load
- [ ] `/mentor/call` - Video call works

### Other Pages
- [ ] `/certificates` - Certificates load
- [ ] `/donate` - Donation campaigns load
- [ ] `/surveys` - Surveys load
- [ ] `/green` - Green challenges load
- [ ] `/volunteer` - Volunteer activities load
- [ ] `/hackathon` - Hackathon listings load
- [ ] `/marketplace` - Marketplace loads
- [ ] `/opportunities` - Opportunities load
- [ ] `/storage` - File storage works
- [ ] `/summer` - Summer campaigns load
- [ ] `/stem` - STEM labs load
- [ ] `/wifi` - WiFi locations load
- [ ] `/mobile-unit` - Mobile units load
- [ ] `/intl` - International programs load
- [ ] `/hs-connection` - HS connection loads

## 2. Backend API Endpoints

### Authentication
- [ ] `POST /api/auth/login` - Login works
- [ ] `POST /api/auth/register` - Registration works
- [ ] `POST /api/auth/forgot-password` - Password reset works

### Map
- [ ] `GET /api/map/pois` - POIs load
- [ ] `GET /api/map/locations` - Locations load
- [ ] `GET /api/map/categories` - Categories load
- [ ] `POST /api/map/ai-analysis` - AI analysis works

### Career
- [ ] `GET /api/career/paths` - Career paths load
- [ ] `GET /api/career/jobs` - Jobs load
- [ ] `POST /api/career/jobs` - Job creation works
- [ ] `GET /api/career/user-careers` - User careers load
- [ ] `POST /api/career/applications` - Applications work

### Community
- [ ] `GET /api/community/posts` - Posts load
- [ ] `POST /api/community/posts` - Post creation works
- [ ] `POST /api/community/posts/:id/like` - Liking works
- [ ] `POST /api/community/posts/:id/comments` - Comments work

### Events
- [ ] `GET /api/events` - Events load
- [ ] `POST /api/events` - Event creation works
- [ ] `POST /api/events/:id/register` - Registration works

### Library
- [ ] `GET /api/library/resources` - Resources load
- [ ] `GET /api/library/search` - Search works

### Scholarships
- [ ] `GET /api/scholarships` - Scholarships load
- [ ] `POST /api/scholarships/:id/apply` - Application works

### Mentor
- [ ] `GET /api/mentoring/mentors` - Mentors load
- [ ] `POST /api/mentoring/book` - Booking works

### Donate
- [ ] `GET /api/donations/campaigns` - Campaigns load
- [ ] `POST /api/donations` - Donation works

### Gamification
- [ ] `GET /api/gamification/progress/:userId` - Progress loads
- [ ] `POST /api/gamification/grant-points` - Points work

### Notifications
- [ ] `GET /api/notifications` - Notifications load
- [ ] `PUT /api/notifications/:id/read` - Mark as read works

### Storage
- [ ] `GET /api/storage/my-files` - Files load
- [ ] `POST /api/storage/upload` - Upload works
- [ ] `DELETE /api/storage/:id` - Delete works

## 3. AI Service

### Chat
- [ ] `POST /api/ai/chat/` - Chat works
- [ ] `POST /api/ai/chat/stream` - Streaming works

### Career
- [ ] `POST /api/ai/career/recommend` - Recommendations work

### Learning Path
- [ ] `POST /api/ai/learning-path/` - Learning paths work

### Mentor
- [ ] `POST /api/ai/mentor/match` - Mentor matching works

### Moderation
- [ ] `POST /api/ai/moderate/` - Moderation works

### Search
- [ ] `GET /api/ai/search/` - Search works

### Geo
- [ ] `POST /api/ai/geo/analyze` - Geo analysis works
- [ ] `POST /api/ai/geo/heatmap` - Heatmap works
- [ ] `POST /api/ai/geo/recommend` - Recommendations work

## 4. Database

- [ ] All tables created correctly
- [ ] All indexes created
- [ ] Foreign keys working
- [ ] Seed data loaded
- [ ] Migrations applied

## 5. Docker

- [ ] PostgreSQL container running
- [ ] Redis container running
- [ ] Backend container running
- [ ] Frontend container running
- [ ] AI Service container running

## 6. Performance

- [ ] Page load times < 3 seconds
- [ ] API response times < 500ms
- [ ] Database queries optimized
- [ ] Caching working correctly
- [ ] Images optimized

## 7. Security

- [ ] Authentication working
- [ ] Authorization working
- [ ] Input validation working
- [ ] CORS configured
- [ ] Rate limiting working
- [ ] HTTPS enabled

## 8. Responsive Design

- [ ] Mobile view (375px) works
- [ ] Tablet view (768px) works
- [ ] Desktop view (1024px) works
- [ ] Large desktop view (1280px) works

## 9. Accessibility

- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] ARIA labels present
- [ ] Color contrast sufficient
- [ ] Focus indicators visible

## 10. Error Handling

- [ ] 404 page displayed
- [ ] 500 error handled
- [ ] Form validation errors displayed
- [ ] API errors handled gracefully
- [ ] Loading states shown

## 11. Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## 12. Deployment

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Seed data loaded
- [ ] SSL certificate valid
- [ ] DNS configured
- [ ] Monitoring set up

## Sign-off

- [ ] QA Lead: _________________ Date: _________
- [ ] Tech Lead: _________________ Date: _________
- [ ] Product Owner: _________________ Date: _________
