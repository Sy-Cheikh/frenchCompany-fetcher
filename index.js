const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// Access environment variables
const PAPPERS_API_KEY = process.env.PAPPERS_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const jobData = new Map();

// Endpoint to fetch company using SIREN 
app.get('/fetchCompany', async (req, res) => {

    const { siren } = req.query;

    // create a unique job id
    const jobId = Date.now().toString();
    jobData.set(jobId, { status: 'in-progress' });


    //   Fetch the company data 
    const companyData = await fetchCompanyData(siren);

    // // Process the company data and fetch linked companies
    if (companyData) {
        const linkedCompanies = await fetchLinkedCompanies(companyData.representants);


        // send the data to the webhook
        sendToWebhook({ jobId, companyData, linkedCompanies });
        jobData.set(jobId, { status: 'completed' });
    } else {
        jobData.set(jobId, { status: 'failed' });
    }
    res.json({ jobId });


    



})

/*
 The /jobsInProgress endpoint offers a way to observe the ongoing processing of jobs by the server, 
    enabling clients to monitor the status of their requests.
    This can be useful for scenarios where jobs may take some time to complete, and clients want to know when they are finished
*/

// Endpoint to get all jobs in progress
app.get('/jobsInProgress', (req, res) => {
    const jobsInProgress = Array.from(jobData.entries())
        .filter(([_, data]) => data.status === 'in-progress')
        .map(([jobId]) => jobId);
    console.log('jobs in progress: ', jobsInProgress)
    res.json({ jobsInProgress });
})


//  Function to fetch company data 
async function fetchCompanyData(siren) {
    try {
        const response = await axios.get('https://api.pappers.fr/v2/entreprise/', {
            params: {
                api_token: PAPPERS_API_KEY,
                siren: siren,
            },
        });
        return response.data;
    } catch (error) {
        console.log('Error fetching company data: ', error.message);
        console.log(PAPPERS_API_KEY);
        return null;
    }
}

// Function to fetch linked companies 
async function fetchLinkedCompanies(companyData) {
    const representants = companyData;
    // console.log(representants)
    if (representants && representants.length > 0) {
        const linkedCompanies = [];

        // Iterate over each representative of the company and fetch linked companies
        for (const representative of representants) {
            const { prenom, personne_morale } = representative;
            
            //  Check if the representative is an individual (personne_morale is false)
            if (!personne_morale && prenom) {
                const linkedCompanyResponse = await axios.get('https://api.pappers.fr/v2/recherche', {

                    // search by first name. This displays all the companies to which this person is linked.
                    /*
                     the api gives us the ability to search with a parameter through the endpoint https://api.pappers.fr/v2/recherche 
                     one way to search for companies linked to a person is to pass him the argument prenom_dirigeant (with the first name(s) we retrieved from the representatives when fetching the company)
                    */
                    params: {
                        api_token: PAPPERS_API_KEY,
                        prenom_dirigeant: prenom
                    },
                });

                //  Add the linked companies to the array
                linkedCompanies.push(linkedCompanyResponse.data);

            }
        }

        return linkedCompanies;
    }
    return null;
}

// Function to send data to the webhook

function sendToWebhook(data) {
    axios.post(WEBHOOK_URL, data, {

    })
        .then(() => console.log('Data sent to webhook succesfully'))
        .catch(error => console.error('Error sending data to webhook:', error.message));
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})