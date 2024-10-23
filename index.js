const core = require('@actions/core');
const { HttpClient } = require('@actions/http-client');
const yaml = require('js-yaml');
const fs = require('fs').promises;

const KARNOT_CLOUD_URL = process.env.KARNOT_CLOUD_URL;
const KARNOT_CLOUD_TOKEN = process.env.KARNOT_CLOUD_TOKEN;

if (!KARNOT_CLOUD_URL || !KARNOT_CLOUD_TOKEN) {
    core.setFailed('KARNOT_CLOUD_URL and KARNOT_CLOUD_TOKEN must be set');
    process.exit(1);
}

core.info(`Karnot Cloud URL: ${KARNOT_CLOUD_URL}`);

// Karnot Cloud API Session
function getHttpClient() {
    const client = new HttpClient('karnot-cloud-action');
    client.requestOptions = {
        headers: {
            'X-Api-Key': KARNOT_CLOUD_TOKEN
        }
    };
    return client;
}

async function checkProjectExists(projectId) {
    const client = getHttpClient();
    const url = `${KARNOT_CLOUD_URL}/project/${projectId}`;
    try {
        const response = await client.get(url);
        if (response.message.statusCode === 200) {
            const resp = JSON.parse(await response.readBody()).data;
            core.debug(`Project data: ${JSON.stringify(resp)}`);
            core.info(`project: ${resp.name}, organization: ${resp.organisation_name}, stack: ${resp.stack}`);
            return true;
        }
    } catch (error) {
        core.error(`Error checking project: ${error.message}`);
    }
    return false;
}

async function updateImage(projectId, serviceName, image) {
    const client = getHttpClient();
    const url = `${KARNOT_CLOUD_URL}/project/deployment/image`;
    try {
        const data = {image, projectId, serviceName, async: false};
        core.debug(`Updating image: Request- ${JSON.stringify(data)}`);
        const response = await client.postJson(url, data);
        core.debug(`Updating image: Response- ${JSON.stringify(response.result)}`);
        return response.statusCode === 200;
    } catch (error) {
        core.error(`Error updating image: ${error.message}`);
        return false;
    }
}

async function updateFiles(projectId, serviceName, serviceFile) {
    const client = getHttpClient();
    const url = `${KARNOT_CLOUD_URL}/project/deployment/chain-forge`;
    let allFilesUpdated = true;
    for (const [file, content] of Object.entries(serviceFile)) {
        try {
            core.info(`Uploading ${file} file`);
            const data = {url: content, projectId, serviceName, async: false};
            core.debug(`Updating files: Request- ${JSON.stringify(data)}`);
            const response = await client.postJson(url, data);
            core.debug(`Updating files: Response- ${JSON.stringify(response.result)}`);
            if (response.statusCode !== 200) {
                allFilesUpdated = false;
            }
        } catch (error) {
            core.error(`Error updating files: ${error.message}`);
            allFilesUpdated = false;
        }
    }
    return allFilesUpdated
}

async function updateConfig(projectId, serviceName, config) {
    const client = getHttpClient();
    setTimeout(() => {
    }, 1000);
    const url = `${KARNOT_CLOUD_URL}/project/deployment/config`;
    try {
        const data = {config, projectId, serviceName};
        core.debug(`Updating config: Request- ${JSON.stringify(data)}`);
        const response = await client.postJson(url, { config, projectId, serviceName, async: false });
        core.debug(`Updating config: Response- ${JSON.stringify(response.result)}`);
        return response.statusCode === 200;
    } catch (error) {
        core.error(`Error updating config: ${error.message}`);
        return false;
    }
}

async function deployPipeline(data, environment) {
    core.info(`Deploying pipeline for environment: ${environment}`);
    for (const project of data.environments) {
        const projectName = project.project;
        if (projectName === environment) {
            const projectId = project.id;
            if (!(await checkProjectExists(projectId))) {
                core.error(`Project with id: ${projectId} does not exist`);
                continue;
            }
            core.info(`Deploying pipeline for project: ${projectName} with id: ${projectId}`);
            const services = project.repos;
            core.debug(`Project data: ${JSON.stringify(project)}`);
            for (const [service, serviceData] of Object.entries(services)) {
                core.info(`Service name: ${service}`);
                const serviceImage = serviceData.image;
                const serviceConfig = serviceData.config;
                const serviceFiles = serviceData.files;
                core.info(`Deploying pipeline for service: ${service} with image: ${serviceImage} and config: ${serviceConfig}`);
                if (serviceFiles) {
                    if (!(await updateFiles(projectId, service, serviceFiles))) {
                        core.error(`Failed to update files for service: ${service}`);
                    }
                }
                if (serviceImage) {
                    if (!(await updateImage(projectId, service, serviceImage))) {
                        core.error(`Failed to update image for service: ${service}`);
                    }
                }
                // wait for 15 seconds before sending a new request to the api
                await new Promise(resolve => setTimeout(resolve, 15e3));
                if (serviceConfig) {
                    if (!(await updateConfig(projectId, service, serviceConfig))) {
                        core.error(`Failed to update config for service: ${service}`);
                    }
                }
            }
        }
    }
}

async function yamlToDict(yamlFile) {
    const fileContents = await fs.readFile(yamlFile, 'utf8');
    return yaml.load(fileContents);
}

async function main() {
    try {
        const inputFile = process.env.INPUT_FILE;
        const environment = process.env.ENVIRONMENT;

        core.info(`Reading file: ${inputFile}`);
        const data = await yamlToDict(inputFile);
        core.debug(`File contents: ${JSON.stringify(data)}`);
        core.info(`Environment: ${environment}`);

        const availableProjects = data.environments.map(v => v.project);

        if (!Object.keys(availableProjects).includes(environment)) {
            core.error(`Environment ${environment} does not exist in config file`);
            throw new Error(`Environment ${environment} does not exist in config file`);
        }

        await deployPipeline(data, environment);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();