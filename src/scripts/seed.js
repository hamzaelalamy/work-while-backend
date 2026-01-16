const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
const User = require('../models/User');
const Company = require('../models/Company');
const Job = require('../models/Job');
const Application = require('../models/Application');

// Data for seeding
const users = [
    {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
        emailVerified: true
    },
    {
        firstName: 'Employer',
        lastName: 'One',
        email: 'employer1@example.com',
        password: 'password123',
        role: 'employer',
        emailVerified: true
    },
    {
        firstName: 'Employer',
        lastName: 'Two',
        email: 'employer2@example.com',
        password: 'password123',
        role: 'employer',
        emailVerified: true
    },
    {
        firstName: 'John',
        lastName: 'Doe',
        email: 'candidate1@example.com',
        password: 'password123',
        role: 'candidate',
        emailVerified: true,
        profile: {
            phone: '+1234567890',
            location: 'New York, USA',
            bio: 'Experienced software developer',
            skills: ['JavaScript', 'React', 'Node.js']
        }
    },
    {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'candidate2@example.com',
        password: 'password123',
        role: 'candidate',
        emailVerified: true,
        profile: {
            phone: '+0987654321',
            location: 'London, UK',
            bio: 'Creative graphic designer',
            skills: ['Photoshop', 'Illustrator', 'Figma']
        }
    },
    {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'candidate3@example.com',
        password: 'password123',
        role: 'candidate',
        emailVerified: true
    }
];

const companies = [
    {
        name: 'Tech Corp',
        description: 'A leading technology company providing innovative solutions.',
        industry: 'technology',
        size: '1000+',
        location: 'San Francisco, CA',
        website: 'https://techcorp.example.com',
        email: 'contact@techcorp.example.com',
        phone: '+15551234567',
        isVerified: true
    },
    {
        name: 'Creative Studio',
        description: 'A design studio focused on branding and digital experiences.',
        industry: 'consulting',
        size: '11-50',
        location: 'New York, NY',
        website: 'https://creativestudio.example.com',
        email: 'hello@creativestudio.example.com',
        phone: '+15559876543',
        isVerified: true
    }
];

const jobs = [
    {
        title: 'Senior Frontend Engineer',
        description: 'We are looking for an experienced Frontend Engineer to join our team. You will be responsible for building high-quality user interfaces using React.',
        location: 'Remote',
        type: 'full-time',
        category: 'Software Development',
        experienceLevel: 'senior',
        salary: {
            min: 100000,
            max: 150000,
            currency: 'USD',
            period: 'yearly'
        },
        isRemote: true,
        skills: ['React', 'TypeScript', 'CSS'],
        status: 'active',
        deadlineDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    {
        title: 'Product Designer',
        description: 'Join our creative team to design beautiful and functional products. You should have a strong portfolio and experience with modern design tools.',
        location: 'New York, NY',
        type: 'full-time',
        category: 'Design',
        experienceLevel: 'mid',
        salary: {
            min: 80000,
            max: 120000,
            currency: 'USD',
            period: 'yearly'
        },
        isRemote: false,
        skills: ['Figma', 'UI/UX', 'Prototyping'],
        status: 'active',
        deadlineDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    },
    {
        title: 'Backend Developer',
        description: 'We need a backend developer to scale our API services. Experience with Node.js and MongoDB is required.',
        location: 'San Francisco, CA',
        type: 'contract',
        category: 'Software Development',
        experienceLevel: 'mid',
        salary: {
            min: 60,
            max: 100,
            currency: 'USD',
            period: 'hourly'
        },
        isRemote: true,
        skills: ['Node.js', 'MongoDB', 'AWS'],
        status: 'active',
        deadlineDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
    },
    {
        title: 'Marketing Manager',
        description: 'Lead our marketing efforts and drive growth. You should be data-driven and creative.',
        location: 'Remote',
        type: 'full-time',
        category: 'Marketing',
        experienceLevel: 'senior',
        salary: {
            min: 90000,
            max: 130000,
            currency: 'USD',
            period: 'yearly'
        },
        isRemote: true,
        skills: ['SEO', 'Content Marketing', 'Analytics'],
        status: 'active',
        deadlineDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    },
    {
        title: 'Junior Web Developer',
        description: 'An entry-level position for a web developer eager to learn and grow.',
        location: 'London, UK',
        type: 'internship',
        category: 'Software Development',
        experienceLevel: 'entry',
        salary: {
            min: 20000,
            max: 30000,
            currency: 'GBP',
            period: 'yearly'
        },
        isRemote: false,
        skills: ['HTML', 'CSS', 'JavaScript'],
        status: 'active',
        deadlineDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    }
];

const seedDB = async () => {
    try {
        // Connect to DB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected...');

        // Clear existing data
        await User.deleteMany({});
        await Company.deleteMany({});
        await Job.deleteMany({});
        await Application.deleteMany({});
        console.log('Data cleared...');

        // Create Users
        // Hash passwords manually or let the model pre-save hook do it.
        // The User model has a pre-save hook to hash password if modified.
        // So we can just pass the plain text password.

        // However, when using create or insertMany, hooks might behave differently depending on the method.
        // create() fires save hooks. insertMany() does NOT fire save hooks by default, unless configured?
        // Mongoose docs say insertMany validates but pre/post save hooks are not executed unless you set { ordered: false, rawResult: false } options?? actually simpler:
        // It's safer to use a loop with save() or just manually hash if using insertMany for speed.
        // Given the small number, loop with save is fine, but insertMany is cleaner if we trust it.
        // Let's use loop for users to ensure password hashing hook fires.

        const createdUsers = [];
        for (const user of users) {
            const newUser = await User.create(user);
            createdUsers.push(newUser);
        }
        console.log(`${createdUsers.length} users created...`);

        const admin = createdUsers.find(u => u.role === 'admin');
        const employer1 = createdUsers.find(u => u.email === 'employer1@example.com');
        const employer2 = createdUsers.find(u => u.email === 'employer2@example.com');
        const candidate1 = createdUsers.find(u => u.email === 'candidate1@example.com');
        const candidate2 = createdUsers.find(u => u.email === 'candidate2@example.com');

        // Create Companies
        companies[0].employer = employer1._id;
        companies[1].employer = employer2._id;

        const createdCompanies = await Company.create(companies); // detailed validation needed? create fires validation
        console.log(`${createdCompanies.length} companies created...`);

        // Create Jobs
        // Distribute jobs between companies
        const techCorp = createdCompanies.find(c => c.name === 'Tech Corp');
        const creativeStudio = createdCompanies.find(c => c.name === 'Creative Studio');

        jobs[0].company = techCorp._id;
        jobs[0].postedBy = employer1._id;

        jobs[1].company = creativeStudio._id;
        jobs[1].postedBy = employer2._id;

        jobs[2].company = techCorp._id;
        jobs[2].postedBy = employer1._id;

        jobs[3].company = creativeStudio._id;
        jobs[3].postedBy = employer2._id;

        jobs[4].company = techCorp._id;
        jobs[4].postedBy = employer1._id;

        const createdJobs = await Job.create(jobs);
        console.log(`${createdJobs.length} jobs created...`);

        // Create Applications
        const applications = [
            {
                applicant: candidate1._id,
                job: createdJobs[0]._id,
                status: 'pending',
                personalInfo: {
                    firstName: candidate1.firstName,
                    lastName: candidate1.lastName,
                    email: candidate1.email,
                    phone: candidate1.profile.phone || '+1111111111'
                },
                source: 'website'
            },
            {
                applicant: candidate1._id,
                job: createdJobs[1]._id,
                status: 'reviewing',
                personalInfo: {
                    firstName: candidate1.firstName,
                    lastName: candidate1.lastName,
                    email: candidate1.email,
                    phone: candidate1.profile.phone || '+1111111111'
                },
                source: 'website'
            },
            {
                applicant: candidate2._id,
                job: createdJobs[0]._id,
                status: 'rejected',
                personalInfo: {
                    firstName: candidate2.firstName,
                    lastName: candidate2.lastName,
                    email: candidate2.email,
                    phone: candidate2.profile.phone || '+2222222222'
                },
                source: 'linkedin'
            },
            {
                applicant: candidate2._id,
                job: createdJobs[4]._id,
                status: 'shortlisted',
                personalInfo: {
                    firstName: candidate2.firstName,
                    lastName: candidate2.lastName,
                    email: candidate2.email,
                    phone: candidate2.profile.phone || '+2222222222'
                },
                source: 'website'
            }
        ];

        await Application.create(applications);
        console.log(`${applications.length} applications created...`);

        console.log('Database seeded successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDB();
