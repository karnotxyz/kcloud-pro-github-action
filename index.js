const core = require('@actions/core');
const { HttpClient } = require('@actions/http-client');
const yaml = require('js-yaml');
const fs = require('fs').promises;

const KARNOT_CLOUD_URL = process.env.KARNOT_CLOUD_URL || 'https://karnot.xyz';
const KARNOT_CLOUD_TOKEN = process.env.KARNOT_CLOUD_TOKEN || '';

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
            core.info(`project: ${resp.name}, organization: ${resp.organization}, stack: ${resp.stack}`);
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
        const response = await client.postJson(url, { image, projectId, serviceName, async: false });
        return response.statusCode === 200;
    } catch (error) {
        core.error(`Error updating image: ${error.message}`);
        return false;
    }
}

async function updateConfig(projectId, serviceName, config) {
    const client = getHttpClient();
    const url = `${KARNOT_CLOUD_URL}/project/deployment/config`;
    try {
        const response = await client.postJson(url, { config, projectId, serviceName });
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
                core.info(`Deploying pipeline for service: ${service} with image: ${serviceImage} and config: ${serviceConfig}`);
                if (serviceImage) {
                    if (!(await updateImage(projectId, service, serviceImage))) {
                        core.error(`Failed to update image for service: ${service}`);
                    }
                }
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
        const inputFile = process.env.input_file;
        const environment = process.env.environment;

        core.info(`Reading file: ${inputFile}`);
        const data = await yamlToDict(inputFile);
        core.debug(`File contents: ${JSON.stringify(data)}`);
        core.info(`Environment: ${environment}`);

        await deployPipeline(data, environment);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();