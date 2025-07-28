import {
  Stack,
  StackProps,
  Duration,
  CfnOutput,
  RemovalPolicy,
  ArnFormat,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as uuid from "uuid";
import { bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import { S3EventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import { join } from "path";
import * as dotenv from "dotenv";

// Load env
dotenv.config();

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Knowledge Base

    const knowledgeBase = new bedrock.VectorKnowledgeBase(
      this,
      "knowledgeBase",
      {
        embeddingsModel:
          bedrock.BedrockFoundationModel.COHERE_EMBED_MULTILINGUAL_V3,
      }
    );

    //S3 and data source config
    const docsBucket = new s3.Bucket(this, "docsbucket-" + uuid.v4(), {
      lifecycleRules: [
        {
          expiration: Duration.days(10),
        },
      ],
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const s3DataSource = new bedrock.S3DataSource(this, "s3DataSource", {
      bucket: docsBucket,
      knowledgeBase: knowledgeBase,
      dataSourceName: "docs",
      chunkingStrategy: bedrock.ChunkingStrategy.DEFAULT,
    });

    const s3PutEventSource = new S3EventSource(docsBucket, {
      events: [s3.EventType.OBJECT_CREATED_PUT],
    });

    //Ingest Lambda

    const lambdaIngestionJob = new NodejsFunction(this, "IngestionJob", {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../lambda/ingest/index.js"),
      functionName: `start-ingestion-trigger`,
      timeout: Duration.minutes(15),
      environment: {
        KNOWLEDGE_BASE_ID: knowledgeBase.knowledgeBaseId,
        DATA_SOURCE_ID: s3DataSource.dataSourceId,
        BUCKET_ARN: docsBucket.bucketArn,
      },
    });

    lambdaIngestionJob.addEventSource(s3PutEventSource);

    lambdaIngestionJob.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:StartIngestionJob"],
        resources: [knowledgeBase.knowledgeBaseArn, docsBucket.bucketArn],
      })
    );

    const apiGateway = new apigw.RestApi(this, "rag", {
      description: "API for RAG",
      restApiName: "rag-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
      },
    });

    //Query Lambda

    const lambdaQuery = new NodejsFunction(this, "Query", {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../lambda/query/index.js"),
      functionName: `query-bedrock-llm`,
      timeout: Duration.seconds(30),
      environment: {
        KNOWLEDGE_BASE_ID: knowledgeBase.knowledgeBaseId,
        MODEL_ID:
          process.env.MODEL_ID || "anthropic.claude-instant-v1",
      },
    });

    lambdaQuery.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:RetrieveAndGenerate",
          "bedrock:Retrieve",
          "bedrock:InvokeModel",
        ],
        resources: ["*"],
      })
    );

    apiGateway.root
      .addResource("docs")
      .addMethod("POST", new apigw.LambdaIntegration(lambdaQuery));

    const apiKey = apiGateway.addApiKey("ChatbotApiKey", {
      apiKeyName: "chatbot-api-key",
    });

    // Rate limiting
    const usagePlan = apiGateway.addUsagePlan("usage-plan", {
      name: "public-chatbot-plan",
      description: "Rate limiting",
      apiStages: [
        {
          api: apiGateway,
          stage: apiGateway.deploymentStage,
        },
      ],
      throttle: {
        rateLimit: 10,
        burstLimit: 20,
      },
      quota: {
        limit: 1000,
        period: apigw.Period.DAY,
      },
    });

    // Associate API key with usage plan
    usagePlan.addApiKey(apiKey);

    //CfnOutput is used to log API Gateway URL and S3 bucket name to console
    new CfnOutput(this, "APIGatewayUrl", {
      value: apiGateway.url,
    });

    new CfnOutput(this, "DocsBucketName", {
      value: docsBucket.bucketName,
    });

    new CfnOutput(this, "ApiKeyId", {
      value: apiKey.keyId,
      description: "API Key ID for usage tracking",
    });
  }
}
