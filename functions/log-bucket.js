'use strict';
const {google} = require('googleapis');
const SCOPES = 'https://www.googleapis.com/auth/drive'
const FOLDER_ID = process.env.FOLDER_ID
const IAM_USER_KEY = process.env.IAM_USER_KEY
const IAM_USER_SECRET = process.env.IAM_USER_SECRET
const BUCKET_NAME = 'my-node-s3'
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    accessKeyId: IAM_USER_KEY,
    secretAccessKey: IAM_USER_SECRET,
    Bucket: BUCKET_NAME
});
const {Duplex} = require('stream');

// # This function for read/download file from s3 bucket
const s3download = async function (params) {
    try {
        console.log(`Hi from Node.js ${process.version} on Lambda!`);
        const data = await s3.getObject({Bucket: params.Bucket, Key: params.Key}).promise()
        console.log(`data: ${JSON.stringify(data)}`)
        return data
    }
    catch (err) {
        console.error(
            err.statusCode || 400,
            err.message || JSON.stringify(err.message)
        )
    }
}

function bufferToStream(myBuffer) {
    let tmp = new Duplex();
    tmp.push(myBuffer);
    tmp.push(null);
    return tmp;
}

/**
 * Insert new file.
 * @return{obj} file Id
 * */
async function uploadBasic(fileName, data) {
    // Get credentials and build service
    const credentials = JSON.parse(process.env.CREDENTIALS)
    console.log(`credentials: ${credentials}`)

    const client = new google.auth.JWT(credentials.client_email, null, credentials.private_key, SCOPES);

    client.authorize(function (err) {
        if (err) {
            console.log(new Error("Error:", err));
            return;
        } else {
            console.log("Connection established with Google API");
        }
    });

    const service = google.drive({version: 'v3', auth:client});
    const fileMetadata = {
        name: fileName.substring(fileName.indexOf('/') + 1),
        mimeType: data.ContentType,
        parents: [FOLDER_ID],
    };
    console.log(`fileMetadata: ${JSON.stringify(fileMetadata)}`)
    const media = {
        mimeType: data.ContentType,
        body: bufferToStream(data.Body)
    };
    console.log(`fileMetadata: ${JSON.stringify(media)}`)
    try {
        const file = await service.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });
        console.log('File Id:', file.data.id);
        return file.data.id;
    } catch (err) {
        throw err;
    }
}

module.exports.log = async (event) => {
    let lista = event.Records[0]
    let fileName = lista.s3.object.key
    console.log(`\n filename: ${JSON.stringify(fileName)} \n ${IAM_USER_KEY}`);

    let params = {
        Bucket: BUCKET_NAME,
        Key: fileName
    };

    let data = await s3download(params)

    await uploadBasic(fileName, data)
};
