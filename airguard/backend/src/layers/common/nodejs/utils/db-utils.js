/**
 * DynamoDB utility wrapper
 * Centralizes client creation and common operations
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const TABLES = {
  AQI_CACHE:     process.env.AQI_CACHE_TABLE     || "airguard-aqi-cache",
  SUBSCRIPTIONS: process.env.SUBSCRIPTIONS_TABLE || "airguard-subscriptions",
  ALERTS_LOG:    process.env.ALERTS_LOG_TABLE     || "airguard-alerts-log"
};

/**
 * Get a single item by partition key (and optional sort key)
 */
async function getItem(tableName, key) {
  const result = await docClient.send(new GetCommand({ TableName: tableName, Key: key }));
  return result.Item || null;
}

/**
 * Put (upsert) an item
 */
async function putItem(tableName, item) {
  await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

/**
 * Query items by partition key, optional filter
 */
async function queryItems(tableName, keyConditionExpression, expressionAttributeValues, indexName = null) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionAttributeValues
  };
  if (indexName) params.IndexName = indexName;
  
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Delete an item
 */
async function deleteItem(tableName, key) {
  await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
}

/**
 * Update specific fields of an item
 */
async function updateItem(tableName, key, updates) {
  const expressions = [];
  const attrValues = {};
  const attrNames = {};

  for (const [field, value] of Object.entries(updates)) {
    const safeName = `#${field}`;
    const safeVal = `:${field}`;
    expressions.push(`${safeName} = ${safeVal}`);
    attrNames[safeName] = field;
    attrValues[safeVal] = value;
  }

  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${expressions.join(", ")}`,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues
  }));
}

/**
 * Scan all items (use sparingly — only for small tables or admin ops)
 */
async function scanItems(tableName, filterExpression = null, expressionAttributeValues = null) {
  const params = { TableName: tableName };
  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  const result = await docClient.send(new ScanCommand(params));
  return result.Items || [];
}

module.exports = {
  docClient,
  TABLES,
  getItem,
  putItem,
  queryItems,
  deleteItem,
  updateItem,
  scanItems
};
