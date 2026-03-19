import { Pinecone } from "@pinecone-database/pinecone";
import { NextResponse } from "next/server";

function getIndex() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  return pc.Index(process.env.PINECONE_INDEX_NAME!);
}

// Define metadata structure expected from Pinecone
interface PineconeRecordMetadata {
  url: string;
  [key: string]: unknown; // optionally allow extra metadata fields
}

interface PineconeFetchResponse {
  records: {
    [id: string]: {
      metadata?: PineconeRecordMetadata;
    };
  };
}

// Backend implementation - Add this to your existing file

async function resolveDocumentUrl(documentId: string): Promise<string | null> {
  try {
    // Method 1: Query Pinecone directly using the existing index
    const queryResponse = (await getIndex().fetch([
      documentId,
    ])) as PineconeFetchResponse;

    const record = queryResponse.records?.[documentId];

    if (record && record.metadata?.url) {
      return record.metadata.url;
    }

    return null;
  } catch (error) {
    console.error("Error resolving document URL from Pinecone:", error);
    return null;
  }
}

// Method 3: Enhanced version with caching
const urlCache = new Map<string, string>();

async function resolveDocumentUrlWithCache(
  documentId: string
): Promise<string | null> {
  // Check cache first
  if (urlCache.has(documentId)) {
    return urlCache.get(documentId) || null;
  }

  try {
    const url = await resolveDocumentUrl(documentId);

    if (url) {
      // Cache the result
      urlCache.set(documentId, url);
    }

    return url;
  } catch (error) {
    console.error("Error resolving document URL with cache:", error);
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  console.log("request", request);
  // Await params before accessing its properties
  const { documentId: rawDocumentId } = await params;
  const documentId = decodeURIComponent(rawDocumentId);

  if (!documentId) {
    return Response.json({ error: "Missing documentId" }, { status: 400 });
  }

  const url = await resolveDocumentUrlWithCache(documentId);

  if (!url) {
    return NextResponse.json({
      statusCode: 404,
      error:
        "Apology this category has no PDF found. Try to contact support for this!",
    });
  }

  return NextResponse.json({
    statusCode: 200,
    documentURL: url,
  });
}
