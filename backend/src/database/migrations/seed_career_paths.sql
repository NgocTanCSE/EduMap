-- =====================================================
-- EduMap Career Paths Seed Data
-- =====================================================

-- =====================================================
-- 1. CAREER PATHS WITH DETAILED ROADMAPS
-- =====================================================

INSERT INTO career_paths (title, description, skills_required, roadmap_json, salary_range, demand_level, resources) VALUES

-- 1. AI Engineer
('AI Engineer', 'Chuyên gia phát triển hệ thống trí tuệ nhân tạo, machine learning và deep learning', 
'["Python", "TensorFlow", "PyTorch", "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "MLOps", "Statistics", "Linear Algebra"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Toán học và Lập trình",
      "duration": "3-4 tháng",
      "description": "Xây dựng nền tảng vững chắc về toán học và lập trình Python",
      "skills": ["Python", "Linear Algebra", "Calculus", "Probability", "Statistics"],
      "resources": ["Coursera: Mathematics for Machine Learning", "Python for Data Science"],
      "milestone": "Hoàn thành 5 bài tập Python và 3 bài toán toán học"
    },
    {
      "id": 2,
      "title": "Machine Learning cơ bản",
      "duration": "2-3 tháng",
      "description": "Học các thuật toán ML cơ bản và cách áp dụng",
      "skills": ["Supervised Learning", "Unsupervised Learning", "Scikit-learn", "Pandas", "NumPy"],
      "resources": ["Andrew Ng: Machine Learning", "Hands-on ML with Scikit-Learn"],
      "milestone": "Xây dựng 3 dự án ML hoàn chỉnh"
    },
    {
      "id": 3,
      "title": "Deep Learning",
      "duration": "3-4 tháng",
      "description": "Học về neural networks và các kiến trúc deep learning",
      "skills": ["Neural Networks", "CNN", "RNN", "TensorFlow", "PyTorch", "Keras"],
      "resources": ["Deep Learning Specialization (Coursera)", "Fast.ai"],
      "milestone": "Xây dựng model nhận diện ảnh và xử lý ngôn ngữ"
    },
    {
      "id": 4,
      "title": "NLP và Computer Vision",
      "duration": "3-4 tháng",
      "description": "Chuyên sâu vào xử lý ngôn ngữ tự nhiên và thị giác máy tính",
      "skills": ["NLP", "Transformers", "BERT", "GPT", "Object Detection", "Image Segmentation"],
      "resources": ["Hugging Face Course", "Stanford CS231n"],
      "milestone": "Xây dựng chatbot AI và hệ thống nhận diện đối tượng"
    },
    {
      "id": 5,
      "title": "MLOps và Production",
      "duration": "2-3 tháng",
      "description": "Học cách deploy và vận hành ML models trong production",
      "skills": ["Docker", "Kubernetes", "MLflow", "Airflow", "AWS/GCP", "Model Monitoring"],
      "resources": ["MLOps Specialization", "Google Cloud ML Engineer"],
      "milestone": "Deploy 2 model lên production với monitoring"
    },
    {
      "id": 6,
      "title": "Dự án thực tế và Portfolio",
      "duration": "2-3 tháng",
      "description": "Xây dựng portfolio và dự án thực tế để apply việc làm",
      "skills": ["Problem Solving", "Communication", "Teamwork", "Portfolio Building"],
      "resources": ["Kaggle Competitions", "GitHub Projects"],
      "milestone": "Hoàn thành 2 dự án Kaggle và portfolio GitHub"
    }
  ],
  "total_duration": "15-21 tháng",
  "difficulty": "hard",
  "prerequisites": ["Kiến thức cơ bản về lập trình", "Đại số tuyến tính", "Xác suất thống kê"]
}',
'$1,500 - $5,000/tháng', 'very_high',
'["https://www.coursera.org/specializations/machine-learning-introduction", "https://www.fast.ai/", "https://huggingface.co/learn"]'
),

-- 2. Data Scientist
('Data Scientist', 'Chuyên gia phân tích dữ liệu, trích xuất insights và đưa ra quyết định kinh doanh dựa trên dữ liệu',
'["Python", "R", "SQL", "Pandas", "NumPy", "Scikit-learn", "Tableau", "Power BI", "Statistics", "A/B Testing"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Thống kê và SQL",
      "duration": "2-3 tháng",
      "description": "Học thống kê cơ bản và SQL cho phân tích dữ liệu",
      "skills": ["Statistics", "SQL", "Descriptive Analytics", "Hypothesis Testing"],
      "resources": ["Khan Academy Statistics", "SQL for Data Analysis"],
      "milestone": "Hoàn thành 5 bài phân tích SQL"
    },
    {
      "id": 2,
      "title": "Python cho Data Science",
      "duration": "2-3 tháng",
      "description": "Học Python và các thư viện phân tích dữ liệu",
      "skills": ["Python", "Pandas", "NumPy", "Matplotlib", "Seaborn"],
      "resources": ["Python for Data Analysis (Wes McKinney)", "DataCamp"],
      "milestone": "Xây dựng 3 dự án phân tích dữ liệu với Python"
    },
    {
      "id": 3,
      "title": "Machine Learning cho Data Science",
      "duration": "3-4 tháng",
      "description": "Áp dụng ML vào phân tích dữ liệu kinh doanh",
      "skills": ["Regression", "Classification", "Clustering", "Scikit-learn", "Feature Engineering"],
      "resources": ["Hands-on ML with Scikit-Learn", "Google ML Crash Course"],
      "milestone": "Xây dựng model dự đoán doanh thu và phân khúc khách hàng"
    },
    {
      "id": 4,
      "title": "Data Visualization và Reporting",
      "duration": "2 tháng",
      "description": "Học cách trực quan hóa và trình bày dữ liệu",
      "skills": ["Tableau", "Power BI", "Matplotlib", "Storytelling", "Dashboard Design"],
      "resources": ["Tableau Public", "Storytelling with Data"],
      "milestone": "Xây dựng 2 dashboard tương tác"
    },
    {
      "id": 5,
      "title": "A/B Testing và Experimentation",
      "duration": "1-2 tháng",
      "description": "Học cách thiết kế và phân tích experiments",
      "skills": ["A/B Testing", "Statistical Significance", "Experiment Design", "Causal Inference"],
      "resources": ["Udacity A/B Testing", "Trustworthy Online Controlled Experiments"],
      "milestone": "Thiết kế và phân tích 2 experiments"
    },
    {
      "id": 6,
      "title": "Dự án Portfolio và Interview Prep",
      "duration": "2-3 tháng",
      "description": "Xây dựng portfolio và chuẩn bị phỏng vấn",
      "skills": ["Portfolio Building", "Case Studies", "Communication", "Business Acumen"],
      "resources": ["Data Science Portfolio Projects", "Ace the Data Science Interview"],
      "milestone": "Hoàn thành 3 dự án portfolio và 5 case studies"
    }
  ],
  "total_duration": "12-17 tháng",
  "difficulty": "medium",
  "prerequisites": ["Kiến thức cơ bản về lập trình", "Thống kê cơ bản"]
}',
'$1,200 - $4,000/tháng', 'very_high',
'["https://www.coursera.org/specializations/data-science", "https://www.datacamp.com/", "https://www.tableau.com/learn"]'
),

-- 3. Full-stack Developer
('Full-stack Developer', 'Lveloper ứng dụng web hoàn chỉnh từ frontend đến backend',
'["JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express", "PostgreSQL", "MongoDB", "Docker", "Git"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Web Development",
      "duration": "2-3 tháng",
      "description": "Học HTML, CSS, JavaScript cơ bản",
      "skills": ["HTML5", "CSS3", "JavaScript ES6+", "Responsive Design", "Git"],
      "resources": ["freeCodeCamp", "The Odin Project", "MDN Web Docs"],
      "milestone": "Xây dựng 3 trang web responsive"
    },
    {
      "id": 2,
      "title": "Frontend Framework",
      "duration": "3-4 tháng",
      "description": "Học React và các framework hiện đại",
      "skills": ["React", "Next.js", "TypeScript", "Tailwind CSS", "State Management"],
      "resources": ["React Documentation", "Next.js Learn", "TypeScript Handbook"],
      "milestone": "Xây dựng ứng dụng React hoàn chỉnh"
    },
    {
      "id": 3,
      "title": "Backend Development",
      "duration": "3-4 tháng",
      "description": "Học Node.js và phát triển API",
      "skills": ["Node.js", "Express", "REST API", "Authentication", "Database Design"],
      "resources": ["Node.js Documentation", "Express.js Guide", "RESTful API Design"],
      "milestone": "Xây dựng REST API với authentication"
    },
    {
      "id": 4,
      "title": "Database và DevOps",
      "duration": "2-3 tháng",
      "description": "Học database và deployment",
      "skills": ["PostgreSQL", "MongoDB", "Docker", "CI/CD", "AWS/GCP Basics"],
      "resources": ["PostgreSQL Tutorial", "Docker Documentation", "AWS Free Tier"],
      "milestone": "Deploy ứng dụng với Docker và CI/CD"
    },
    {
      "id": 5,
      "title": "Dự án Full-stack",
      "duration": "3-4 tháng",
      "description": "Xây dựng dự án full-stack hoàn chỉnh",
      "skills": ["System Design", "Performance Optimization", "Security", "Testing"],
      "resources": ["Full Stack Open", "Build Real World Projects"],
      "milestone": "Xây dựng và deploy 2 dự án full-stack"
    },
    {
      "id": 6,
      "title": "Portfolio và Job Search",
      "duration": "1-2 tháng",
      "description": "Xây dựng portfolio và tìm việc",
      "skills": ["Portfolio Building", "Resume Writing", "Interview Prep", "Networking"],
      "resources": ["GitHub Portfolio Guide", "Tech Interview Handbook"],
      "milestone": "Portfolio GitHub 5+ projects và apply 10+ việc"
    }
  ],
  "total_duration": "14-20 tháng",
  "difficulty": "medium",
  "prerequisites": ["Kiến thức cơ bản về máy tính", "Logic tư duy"]
}',
'$800 - $3,500/tháng', 'high',
'["https://www.freecodecamp.org/", "https://nextjs.org/learn", "https://fullstackopen.com/"]'
),

-- 4. UI/UX Designer
('UI/UX Designer', 'Chuyên gia thiết kế giao diện và trải nghiệm người dùng cho ứng dụng và website',
'["Figma", "Adobe XD", "Sketch", "Prototyping", "User Research", "Wireframing", "Design Systems", "Typography", "Color Theory", "Accessibility"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Design",
      "duration": "2-3 tháng",
      "description": "Học các nguyên tắc thiết kế cơ bản",
      "skills": ["Design Principles", "Typography", "Color Theory", "Layout", "Visual Hierarchy"],
      "resources": ["Design Principles (Coursera)", "Refactoring UI"],
      "milestone": "Thiết kế 5 UI screens cơ bản"
    },
    {
      "id": 2,
      "title": "UI Design với Figma",
      "duration": "2-3 tháng",
      "description": "Thành thạo Figma cho UI design",
      "skills": ["Figma", "Auto Layout", "Components", "Design Systems", "Prototyping"],
      "resources": ["Figma Documentation", "Figma Academy"],
      "milestone": "Xây dựng design system hoàn chỉnh"
    },
    {
      "id": 3,
      "title": "UX Research",
      "duration": "2 tháng",
      "description": "Học cách nghiên cứu người dùng",
      "skills": ["User Research", "User Interviews", "Surveys", "Usability Testing", "Personas"],
      "resources": ["UX Research Guide", "Don Norman: Design of Everyday Things"],
      "milestone": "Thực hiện 3 usability tests"
    },
    {
      "id": 4,
      "title": "Interaction Design",
      "duration": "2-3 tháng",
      "description": "Thiết kế tương tác và micro-interactions",
      "skills": ["Interaction Design", "Micro-interactions", "Animation", "Prototyping", "User Flows"],
      "resources": ["Interaction Design Foundation", "Principle", "Framer"],
      "milestone": "Thiết kế 2 app với interaction details"
    },
    {
      "id": 5,
      "title": "Portfolio và Case Studies",
      "duration": "2-3 tháng",
      "description": "Xây dựng portfolio UX case studies",
      "skills": ["Case Study Writing", "Portfolio Design", "Presentation", "Storytelling"],
      "resources": ["UX Portfolio Formula", "Case Study Club"],
      "milestone": "Hoàn thành 3 case studies cho portfolio"
    }
  ],
  "total_duration": "10-14 tháng",
  "difficulty": "medium",
  "prerequisites": ["Sở thích về thiết kế", "Kỹ năng quan sát"]
}',
'$700 - $3,000/tháng', 'high',
'["https://www.figma.com/", "https://www.interaction-design.org/", "https://www.nngroup.com/"]'
),

-- 5. DevOps Engineer
('DevOps Engineer', 'Chuyên gia vận hành và tự động hóa quy trình phát triển phần mềm',
'["Linux", "Docker", "Kubernetes", "Jenkins", "GitHub Actions", "Terraform", "AWS/Azure/GCP", "Monitoring", "Security", "Scripting"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Linux và Networking",
      "duration": "2-3 tháng",
      "description": "Học Linux cơ bản và networking",
      "skills": ["Linux Commands", "Shell Scripting", "Networking", "TCP/IP", "DNS", "HTTP"],
      "resources": ["Linux Journey", "Linux Administration Course"],
      "milestone": "Thành thạo Linux command line và networking basics"
    },
    {
      "id": 2,
      "title": "Containerization với Docker",
      "duration": "2 tháng",
      "description": "Học Docker và container orchestration",
      "skills": ["Docker", "Docker Compose", "Dockerfile", "Container Security", "Image Optimization"],
      "resources": ["Docker Documentation", "Docker Deep Dive"],
      "milestone": "Containerize 3 ứng dụng khác nhau"
    },
    {
      "id": 3,
      "title": "Kubernetes",
      "duration": "3-4 tháng",
      "description": "Học Kubernetes cho production deployment",
      "skills": ["Kubernetes", "Pods", "Services", "Deployments", "Helm", "Kustomize"],
      "resources": ["Kubernetes Documentation", "Kubernetes in Action"],
      "milestone": "Deploy ứng dụng lên cluster Kubernetes"
    },
    {
      "id": 4,
      "title": "CI/CD và Automation",
      "duration": "2-3 tháng",
      "description": "Học CI/CD pipelines và automation",
      "skills": ["Jenkins", "GitHub Actions", "GitLab CI", "Pipeline Design", "Testing Automation"],
      "resources": ["Jenkins Documentation", "GitHub Actions Course"],
      "milestone": "Xây dựng CI/CD pipeline hoàn chỉnh"
    },
    {
      "id": 5,
      "title": "Cloud và Infrastructure as Code",
      "duration": "3-4 tháng",
      "description": "Học cloud computing và IaC",
      "skills": ["AWS/Azure/GCP", "Terraform", "Ansible", "Infrastructure Design", "Cost Optimization"],
      "resources": ["AWS Free Tier", "Terraform Documentation"],
      "milestone": "Deploy infrastructure với Terraform trên AWS"
    },
    {
      "id": 6,
      "title": "Monitoring và Security",
      "duration": "2 tháng",
      "description": "Học monitoring và security cho DevOps",
      "skills": ["Prometheus", "Grafana", "ELK Stack", "Security Best Practices", "Compliance"],
      "resources": ["Prometheus Documentation", "DevSecOps Guide"],
      "milestone": "Setup monitoring stack và security audit"
    }
  ],
  "total_duration": "14-18 tháng",
  "difficulty": "hard",
  "prerequisites": ["Kiến thức cơ bản về lập trình", "Hiểu biết về web servers"]
}',
'$1,200 - $4,500/tháng', 'very_high',
'["https://www.docker.com/", "https://kubernetes.io/docs/home/", "https://www.terraform.io/docs"]'
),

-- 6. Cybersecurity Analyst
('Cybersecurity Analyst', 'Chuyên gia bảo mật thông tin, phát hiện và ngăn chặn mối đe dọa mạng',
'["Network Security", "Cryptography", "Penetration Testing", "SIEM", "Firewalls", "Incident Response", "Linux", "Python", "SQL", "Compliance"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng An ninh mạng",
      "duration": "2-3 tháng",
      "description": "Học các khái niệm cơ bản về bảo mật",
      "skills": ["Security Fundamentals", "CIA Triad", "Risk Assessment", "Compliance"],
      "resources": ["CompTIA Security+", "Cybrary"],
      "milestone": "Hoàn thành chứng chỉ Security+ basics"
    },
    {
      "id": 2,
      "title": "Networking và Security",
      "duration": "2-3 tháng",
      "description": "Học networking và security protocols",
      "skills": ["TCP/IP", "Firewalls", "VPNs", "IDS/IPS", "Network Security"],
      "resources": ["Network Security Course", "Wireshark Tutorial"],
      "milestone": "Configure firewall và analyze network traffic"
    },
    {
      "id": 3,
      "title": "Operating System Security",
      "duration": "2 tháng",
      "description": "Học bảo mật hệ điều hành",
      "skills": ["Linux Security", "Windows Security", "Hardening", "Access Control"],
      "resources": ["Linux Security Course", "Windows Security Baselines"],
      "milestone": "Harden 2 hệ điều hành khác nhau"
    },
    {
      "id": 4,
      "title": "Penetration Testing",
      "duration": "3-4 tháng",
      "description": "Học ethical hacking và penetration testing",
      "skills": ["Penetration Testing", "Vulnerability Assessment", "Metasploit", "Burp Suite", "OWASP Top 10"],
      "resources": ["PTES", "OWASP Testing Guide", "Hack The Box"],
      "milestone": "Hoàn thành 5 bài penetration testing"
    },
    {
      "id": 5,
      "title": "Security Operations",
      "duration": "2-3 tháng",
      "description": "Học vận hành bảo mật và incident response",
      "skills": ["SIEM", "Splunk", "Incident Response", "Threat Hunting", "Digital Forensics"],
      "resources": ["Splunk Documentation", "SANS Incident Response"],
      "milestone": "Setup SIEM và xử lý 3 incident scenarios"
    },
    {
      "id": 6,
      "title": "Certifications và Career",
      "duration": "2-3 tháng",
      "description": "Chuẩn bị chứng chỉ vàapply việc",
      "skills": ["CEH", "OSCP", "CISSP", "Resume Building", "Interview Prep"],
      "resources": ["EC-Council CEH", "Offensive Security OSCP"],
      "milestone": "Đạt CEH hoặc OSCP certification"
    }
  ],
  "total_duration": "13-18 tháng",
  "difficulty": "hard",
  "prerequisites": ["Kiến thức cơ bản về networking", "LINUX basics"]
}',
'$1,000 - $4,000/tháng', 'high',
'["https://www.cybrary.com/", "https://www.hackthebox.com/", "https://owasp.org/"]'
),

-- 7. Mobile App Developer
('Mobile App Developer', 'Phát triển ứng dụng di động cho iOS và Android',
'["React Native", "Flutter", "Swift", "Kotlin", "Firebase", "REST API", "State Management", "Testing", "App Store Optimization", "UI/UX"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Mobile Development",
      "duration": "2-3 tháng",
      "description": "Học các khái niệm cơ bản về mobile development",
      "skills": ["Mobile Fundamentals", "UI/UX Principles", "Responsive Design", "App Architecture"],
      "resources": ["Google Android Course", "Apple iOS Course"],
      "milestone": "Xây dựng 2 app đơn giản (1 iOS, 1 Android)"
    },
    {
      "id": 2,
      "title": "Cross-platform với React Native",
      "duration": "3-4 tháng",
      "description": "Học React Native cho cross-platform development",
      "skills": ["React Native", "JavaScript", "TypeScript", "Navigation", "State Management"],
      "resources": ["React Native Documentation", "Expo Documentation"],
      "milestone": "Xây dựng app React Native hoàn chỉnh"
    },
    {
      "id": 3,
      "title": "Backend Integration",
      "duration": "2-3 tháng",
      "description": "Học cách tích hợp backend và APIs",
      "skills": ["REST API", "Firebase", "Authentication", "Real-time Data", "Push Notifications"],
      "resources": ["Firebase Documentation", "REST API Design"],
      "milestone": "Tích hợp app với backend và authentication"
    },
    {
      "id": 4,
      "title": "Advanced Features",
      "duration": "2-3 tháng",
      "description": "Học các tính năng nâng cao",
      "skills": ["Offline Support", "Performance Optimization", "Analytics", "Testing", "CI/CD"],
      "resources": ["Mobile Performance Guide", "App Testing Course"],
      "milestone": "Optimize performance và setup CI/CD"
    },
    {
      "id": 5,
      "title": "App Store và Portfolio",
      "duration": "2 tháng",
      "description": "Publish app lên store và xây dựng portfolio",
      "skills": ["App Store Optimization", "ASO", "Marketing", "Portfolio Building"],
      "resources": ["ASO Guide", "App Marketing Course"],
      "milestone": "Publish 1 app lên App Store và Google Play"
    }
  ],
  "total_duration": "11-15 tháng",
  "difficulty": "medium",
  "prerequisites": ["JavaScript basics", "HTML/CSS"]
}',
'$800 - $3,500/tháng', 'high',
'["https://reactnative.dev/", "https://flutter.dev/", "https://firebase.google.com/"]'
),

-- 8. Cloud Architect
('Cloud Architect', 'Chuyên gia thiết kế và triển khai giải pháp cloud computing',
'["AWS", "Azure", "GCP", "Terraform", "Kubernetes", "Microservices", "Security", "Cost Optimization", "Networking", "Serverless"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Cloud",
      "duration": "2-3 tháng",
      "description": "Học các khái niệm cơ bản về cloud computing",
      "skills": ["Cloud Fundamentals", "IaaS", "PaaS", "SaaS", "Cloud Models"],
      "resources": ["AWS Cloud Practitioner", "Azure Fundamentals", "GCP Associate"],
      "milestone": "Đạt chứng chỉ Cloud Practitioner"
    },
    {
      "id": 2,
      "title": "AWS Core Services",
      "duration": "3-4 tháng",
      "description": "Học các dịch vụ cốt lõi của AWS",
      "skills": ["EC2", "S3", "RDS", "Lambda", "VPC", "IAM", "CloudFormation"],
      "resources": ["AWS Documentation", "AWS Well-Architected Framework"],
      "milestone": "Deploy ứng dụng trên AWS với 5+ services"
    },
    {
      "id": 3,
      "title": "Infrastructure as Code",
      "duration": "2-3 tháng",
      "description": "Học Terraform và automation",
      "skills": ["Terraform", "Ansible", "CloudFormation", "ARM Templates", "Infrastructure Design"],
      "resources": ["Terraform Documentation", "HashiCorp Learn"],
      "milestone": "Xây dựng infrastructure với Terraform"
    },
    {
      "id": 4,
      "title": "Container Orchestration",
      "duration": "2-3 tháng",
      "description": "Học Kubernetes trên cloud",
      "skills": ["Kubernetes", "EKS", "AKS", "GKE", "Service Mesh", "Monitoring"],
      "resources": ["Kubernetes Documentation", "Cloud Kubernetes Services"],
      "milestone": "Deploy Kubernetes cluster trên AWS EKS"
    },
    {
      "id": 5,
      "title": "Architecture Design",
      "duration": "3-4 tháng",
      "description": "Học thiết kế kiến trúc cloud",
      "skills": ["System Design", "High Availability", "Disaster Recovery", "Cost Optimization", "Security"],
      "resources": ["AWS Well-Architected Framework", "Cloud Architecture Patterns"],
      "milestone": "Thiết kế kiến trúc cho 2 case studies"
    },
    {
      "id": 6,
      "title": "Certifications và Career",
      "duration": "2-3 tháng",
      "description": "Chuẩn bị chứng chỉ và apply việc",
      "skills": ["AWS Solutions Architect", "Azure Architect", "GCP Architect", "Interview Prep"],
      "resources": ["AWS SA Associate", "Azure Architect Expert"],
      "milestone": "Đạt AWS Solutions Architect Associate"
    }
  ],
  "total_duration": "14-20 tháng",
  "difficulty": "hard",
  "prerequisites": ["Linux basics", "Networking", "Web development basics"]
}',
'$1,500 - $5,500/tháng', 'very_high',
'["https://aws.amazon.com/training/", "https://azure.microsoft.com/en-us/training/", "https://cloud.google.com/training"]'
),

-- 9. Product Manager
('Product Manager', 'Quản lý sản phẩm phần mềm từ ý tưởng đến ra mắt thị trường',
'["Product Strategy", "User Research", "Agile/Scrum", "Data Analysis", "Roadmapping", "Stakeholder Management", "SQL", "Analytics", "Communication", "Leadership"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Product Management",
      "duration": "2 tháng",
      "description": "Học các khái niệm cơ bản về PM",
      "skills": ["Product Fundamentals", "Product Lifecycle", "Market Research", "Competitive Analysis"],
      "resources": ["Product School", "Inspired by Marty Cagan"],
      "milestone": "Phân tích 3 sản phẩm cạnh tranh"
    },
    {
      "id": 2,
      "title": "User Research và Discovery",
      "duration": "2-3 tháng",
      "description": "Học cách nghiên cứu người dùng",
      "skills": ["User Interviews", "Surveys", "Usability Testing", "Personas", "Journey Mapping"],
      "resources": ["UX Research Guide", "Lean Product Playbook"],
      "milestone": "Thực hiện 5 user interviews và tạo personas"
    },
    {
      "id": 3,
      "title": "Agile và Scrum",
      "duration": "1-2 tháng",
      "description": "Học Agile/Scrum methodology",
      "skills": ["Scrum", "Kanban", "Sprint Planning", "Backlog Management", "Retrospectives"],
      "resources": ["Scrum Guide", "Agile Alliance"],
      "milestone": "Leading 2 sprints với team"
    },
    {
      "id": 4,
      "title": "Data-Driven Product Decisions",
      "duration": "2-3 tháng",
      "description": "Học cách đưa ra quyết định dựa trên dữ liệu",
      "skills": ["SQL", "Analytics", "A/B Testing", "Metrics", "KPIs", "Data Visualization"],
      "resources": ["SQL for Product Managers", "Product Analytics Course"],
      "milestone": "Phân tích dữ liệu và đưa ra 3 product recommendations"
    },
    {
      "id": 5,
      "title": "Product Strategy và Roadmapping",
      "duration": "2-3 tháng",
      "description": "Học xây dựng chiến lược và roadmap sản phẩm",
      "skills": ["Product Strategy", "Roadmapping", "Prioritization", "Stakeholder Management"],
      "resources": ["Product Strategy Course", "Roadmapping Tools"],
      "milestone": "Xây dựng product roadmap cho 1 sản phẩm"
    },
    {
      "id": 6,
      "title": "Portfolio và Career",
      "duration": "2 tháng",
      "description": "Xây dựng portfolio và apply việc PM",
      "skills": ["Portfolio Building", "Case Studies", "Interview Prep", "Networking"],
      "resources": ["PM Interview Handbook", "Case Study Practice"],
      "milestone": "Hoàn thành 3 PM case studies"
    }
  ],
  "total_duration": "11-15 tháng",
  "difficulty": "medium",
  "prerequisites": ["Kinh nghiệm làm việc", "Kỹ năng giao tiếp"]
}',
'$1,200 - $4,500/tháng', 'high',
'["https://www.productschool.com/", "https://www.svpg.com/", "https://www.mindtheproduct.com/"]'
),

-- 10. Blockchain Developer
('Blockchain Developer', 'Phát triển ứng dụng phi tập trung (dApps) và smart contracts',
'["Solidity", "Ethereum", "Web3.js", "Hardhat", "Smart Contracts", "DeFi", "NFT", "IPFS", "React", "Node.js"]',
'{
  "steps": [
    {
      "id": 1,
      "title": "Nền tảng Blockchain",
      "duration": "2 tháng",
      "description": "Học các khái niệm cơ bản về blockchain",
      "skills": ["Blockchain Fundamentals", "Cryptography", "Consensus Mechanisms", "Bitcoin", "Ethereum"],
      "resources": ["Blockchain Basics (Coursera)", "Ethereum Whitepaper"],
      "milestone": "Hiểu rõ cách blockchain hoạt động"
    },
    {
      "id": 2,
      "title": "Smart Contracts với Solidity",
      "duration": "3-4 tháng",
      "description": "Học phát triển smart contracts trên Ethereum",
      "skills": ["Solidity", "Smart Contracts", "Hardhat", "Testing", "Security"],
      "resources": ["CryptoZombies", "Solidity Documentation"],
      "milestone": "Xây dựng 3 smart contracts hoàn chỉnh"
    },
    {
      "id": 3,
      "title": "DApp Development",
      "duration": "3-4 tháng",
      "description": "Học phát triển ứng dụng phi tập trung",
      "skills": ["Web3.js", "Ethers.js", "React", "IPFS", "MetaMask", "Wallet Integration"],
      "resources": ["DApp University", "Alchemy University"],
      "milestone": "Xây dựng DApp hoàn chỉnh với wallet integration"
    },
    {
      "id": 4,
      "title": "DeFi và NFT",
      "duration": "2-3 tháng",
      "description": "Học về DeFi protocols và NFTs",
      "skills": ["DeFi", "AMM", "Lending", "NFT", "ERC-721", "ERC-1155"],
      "resources": ["DeFi Academy", "NFT Development Course"],
      "milestone": "Xây dựng NFT marketplace hoặc DeFi protocol"
    },
    {
      "id": 5,
      "title": "Security và Auditing",
      "duration": "2 tháng",
      "description": "Học bảo mật smart contracts",
      "skills": ["Smart Contract Security", "Auditing", "Common Vulnerabilities", "Best Practices"],
      "resources": ["Smart Contract Best Practices", "Audit Course"],
      "milestone": "Audit 2 smart contracts và fix vulnerabilities"
    },
    {
      "id": 6,
      "title": "Portfolio và Career",
      "duration": "2 tháng",
      "description": "Xây dựng portfolio vàapply việc",
      "skills": ["Portfolio Building", "Open Source", "Networking", "Interview Prep"],
      "resources": ["Web3 Career Guide", "Blockchain Jobs"],
      "milestone": "Deploy 2 DApps lên mainnet và build portfolio"
    }
  ],
  "total_duration": "14-18 tháng",
  "difficulty": "hard",
  "prerequisites": ["JavaScript basics", "Web development", "Basic cryptography"]
}',
'$1,500 - $6,000/tháng', 'medium',
'["https://cryptozombies.io/", "https://www.alchemy.com/university", "https://ethereum.org/en/developers/"]'
)

ON CONFLICT (title) DO NOTHING;

-- =====================================================
-- 2. CAREER PATH CATEGORIES
-- =====================================================

-- Create career categories if not exists
CREATE TABLE IF NOT EXISTS career_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO career_categories (name, description, icon) VALUES
('Technology', 'Các nghề trong lĩnh vực công nghệ thông tin', 'code'),
('Design', 'Các nghề trong lĩnh vực thiết kế', 'palette'),
('Business', 'Các nghề trong lĩnh vực kinh doanh', 'briefcase'),
('Data', 'Các nghề trong lĩnh vực dữ liệu', 'database'),
('Security', 'Các nghề trong lĩnh vực bảo mật', 'shield'),
('Cloud', 'Các nghề trong lĩnh vực cloud computing', 'cloud')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SUMMARY
-- =====================================================
-- Total career paths: 10
-- Each path has 6 steps with detailed roadmap_json
-- Total resources: 30+ learning resources
-- Career categories: 6 categories
-- =====================================================
