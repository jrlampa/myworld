const axios = require('axios');

async function inspect() {
    try {
        // List all jobs
        const list = await axios.get('http://localhost:3000/api/topography/jobs');
        const jobs = list.data.jobs;
        console.log(`Found ${jobs.length} jobs.`);

        if (jobs.length === 0) return;

        // Get last job
        const lastJob = jobs[jobs.length - 1];
        console.log(`Inspecting Job ID: ${lastJob.id}`);

        const res = await axios.get(`http://localhost:3000/api/topography/jobs/${lastJob.id}`);
        const job = res.data.job;

        console.log('Status:', job.status);
        console.log('Error:', job.error);
        console.log('Result Present:', !!job.result);
        console.log('FinishedAt:', job.finishedAt);

        if (job.result) {
            console.log('Result Keys:', Object.keys(job.result));
            if (job.result.analysis) {
                console.log('Analysis Keys:', Object.keys(job.result.analysis));
            }
        }
    } catch (e) {
        console.error(e.message);
    }
}

inspect();
