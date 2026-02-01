const fs = require('fs');
const path = require('path');

// config
const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN || ''; // Optional: Use if public permissions are tricky, usually not needed for public GET
const OUTPUT_FILE = path.join(__dirname, 'data.json');

async function fetchData() {
    console.log(`Fetching data from ${STRAPI_URL}...`);

    try {
        const headers = API_TOKEN ? { 'Authorization': `Bearer ${API_TOKEN}` } : {};

        // 1. Fetch About Page (with CV)
        console.log('Fetching About Page...');
        const aboutRes = await fetch(`${STRAPI_URL}/api/about-page?populate[cv][populate]=*`, { headers });
        const aboutJson = await aboutRes.json();

        // 2. Fetch All Projects (Deep populate for both list and details)
        // Note: Using a large limit to get all projects
        console.log('Fetching Projects...');
        const projectsRes = await fetch(`${STRAPI_URL}/api/projects?populate[thumbnail]=true&populate[content][populate]=*&sort=year:desc&pagination[pageSize]=100`, { headers });
        const projectsJson = await projectsRes.json();

        const fullData = {
            about: aboutJson.data,
            projects: projectsJson.data,
            meta: {
                generatedAt: new Date().toISOString()
            }
        };

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(fullData, null, 2));
        console.log(`Success! Data saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error fetching data:', error);
        process.exit(1);
    }
}

fetchData();
