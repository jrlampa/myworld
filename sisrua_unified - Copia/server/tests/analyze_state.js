const fs = require('fs');
const path = require('path');

const stateFile = path.join(__dirname, '../../server/data/topography-state.json');

try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const data = JSON.parse(raw);
    const jobs = data.jobs || [];

    if (jobs.length > 0) {
        // Sort by createdAt
        jobs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const lastJob = jobs[jobs.length - 1];

        console.log('FINAL_STATUS:', lastJob.status);
        console.log('FINAL_ERROR:', lastJob.error);
    } else {
        console.log('NO_JOBS');
    }
} catch (e) {
    console.error(`Error: ${e.message}`);
}
process.exit(0);
