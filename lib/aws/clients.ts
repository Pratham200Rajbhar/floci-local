import { S3Client } from "@aws-sdk/client-s3";
import { RDSClient } from "@aws-sdk/client-rds";
import { EC2Client } from "@aws-sdk/client-ec2";
import { ElastiCacheClient } from "@aws-sdk/client-elasticache";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";
import { SESClient } from "@aws-sdk/client-ses";
import { awsConfig } from "./config";

function getBaseClientConfig() {
  const isFlociEndpoint = Boolean(awsConfig.FLOCI_ENDPOINT);

  return {
    region: awsConfig.AWS_REGION,
    credentials: {
      accessKeyId: awsConfig.AWS_ACCESS_KEY_ID,
      secretAccessKey: awsConfig.AWS_SECRET_ACCESS_KEY,
    },
    ...(isFlociEndpoint ? { endpoint: awsConfig.FLOCI_ENDPOINT } : {}),
    maxAttempts: 5,
    retryMode: "adaptive" as const,
  };
}

export function getS3Client(): S3Client {
  return new S3Client({
    ...getBaseClientConfig(),
    forcePathStyle: true, // Required for local S3 emulation
  });
}

export function getRDSClient(): RDSClient {
  return new RDSClient(getBaseClientConfig());
}

export function getEC2Client(): EC2Client {
  return new EC2Client(getBaseClientConfig());
}

export function getElastiCacheClient(): ElastiCacheClient {
  return new ElastiCacheClient(getBaseClientConfig());
}

export function getLambdaClient(): LambdaClient {
  return new LambdaClient(getBaseClientConfig());
}

export function getSQSClient(): SQSClient {
  return new SQSClient(getBaseClientConfig());
}

export function getSNSClient(): SNSClient {
  return new SNSClient(getBaseClientConfig());
}

export function getSESClient(): SESClient {
  return new SESClient(getBaseClientConfig());
}
