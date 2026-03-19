import { NextRequest, NextResponse } from "next/server";
// import OpenAI from "openai";



interface ExtractedData {
  id: string;
  title: string;
  category: string;
  description: string;
  keyQuestion: string[]; // Changed to array of strings
  usefulFor: string;
  url: string;
  key: string;
}

// Function to extract category from filename based on ID pattern
function extractCategoryFromFilename(filename: string): string {
  const cleanFilename = filename.replace(".pdf", "").toUpperCase();

  // Look for patterns like 443ML, 123CL, 789DK
  const mlPattern = /Missing Lessons Series|ML-|ML |474ML/i;
  // /\d+ML/;
  const clPattern = /Checklist Series|CL-|CL |474CL/i;
  // /\d+CL/;
  const dkPattern = /Detailed Knowledge Series|DK-|DK |474DK/i;
  // /\d+DK/;
  const ffPattern = /Financial Fluency Series|FF-|FF |474FF/i;
  // /\d+FF/;
  const aePattern =
    /Advisory Essentials Series|AE-|AE |Advisor Essentials Series|474AE/i;
  // /\d+AE/;

  if (mlPattern.test(cleanFilename)) {
    return "Missing Lesson Series";
  } else if (clPattern.test(cleanFilename)) {
    return "Checklist & Practical Guide Series";
  } else if (dkPattern.test(cleanFilename)) {
    return "Detailed Knowledge Series";
  } else if (ffPattern.test(cleanFilename)) {
    return "Financial Fluency Series";
  } else if (aePattern.test(cleanFilename)) {
    return "Advisory Essentials Series";
  }

  // Default fallback if no pattern is found
  return "Missing Lesson";
}

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, filename } = body;

    if (!text || !filename) {
      return NextResponse.json(
        { error: "Missing required fields: text and filename" },
        { status: 400 }
      );
    }

    // Extract category from filename ID pattern
    const detectedCategory = extractCategoryFromFilename(filename);

    // Create a structured prompt for OpenAI
    const prompt = `
You are an AI document analyzer. Analyze the following document text and extract structured metadata. 

Document filename: ${filename}
Document text:
${text.substring(0, 4000)} // Limit text to avoid token limits

Please extract and return a JSON object with the following structure:
{
  "title": "Clean, descriptive title of the document (remove codes, numbers, prefixes)",
  "category": "${detectedCategory}",
  "description": "2-3 sentence summary of what this document contains",
  "keyQuestion": ["What is the main question this document answers?", "What specific problem does this document solve?", "What key insights does this document provide?"],
  "usefulFor": "Who would find this document most useful? (target audience)",
  "mainTopics": ["topic1", "topic2", "topic3"] // 3-5 main topics covered
}

Guidelines:
- Make the title clean and professional, removing any alphanumeric codes
- Use the provided category: "${detectedCategory}"
- Keep description concise but informative
- For keyQuestion: provide 3-5 specific questions that this document answers or addresses
- Focus on practical value in "usefulFor" field
- Identify the core topics/themes

Return only valid JSON, no additional text.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a document analysis expert. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    let extractedInfo;
    try {
      extractedInfo = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseText);
      console.log("parseError", parseError);
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Generate additional fields
    const cleanFilename = filename.replace(".pdf", "");

    // Default questions based on category
    const getDefaultQuestions = (category: string): string[] => {
      const categoryLower = category.toLowerCase();
      if (categoryLower.includes("lesson")) {
        return [
          "What key lesson does this document teach?",
          "What skills or knowledge will I gain from this lesson?",
          "How can I apply this lesson in practice?",
        ];
      } else if (categoryLower.includes("checklist")) {
        return [
          "What steps does this checklist guide me through?",
          "What tasks or processes does this checklist help me complete?",
          "How can this checklist improve my workflow?",
        ];
      } else if (categoryLower.includes("knowledge")) {
        return [
          "What detailed knowledge does this document provide?",
          "What concepts or principles are explained in this series?",
          "How does this knowledge apply to real-world scenarios?",
        ];
      } else if (categoryLower.includes("financial")) {
        return [
          "What financial concepts does this document explain?",
          "How can this help improve my financial understanding?",
          "What financial strategies or insights are covered?",
        ];
      } else if (categoryLower.includes("advisory")) {
        return [
          "What advisory principles does this document cover?",
          "How can this improve my advisory skills?",
          "What essential practices are outlined for advisors?",
        ];
      }
      return [
        "What information is contained in this document?",
        "What problems does this document help solve?",
        "How can this document be useful to me?",
      ];
    };

    const generateSafeId = (originalId: string): string =>
      Buffer.from(originalId)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 45);

    const safeId = generateSafeId(filename);

    // Create the final structured data
    const extractedData: ExtractedData = {
      id: `${cleanFilename}`,
      title: extractedInfo.title || filename.replace(".pdf", ""),
      category: detectedCategory, // Use the detected category
      description:
        extractedInfo.description || `Content extracted from ${filename}`,
      keyQuestion:
        extractedInfo.keyQuestion && Array.isArray(extractedInfo.keyQuestion)
          ? extractedInfo.keyQuestion
          : getDefaultQuestions(detectedCategory),
      usefulFor: extractedInfo.usefulFor || "General readers and researchers",
      url: "", // Can be populated later if needed
      key: safeId,
    };

    return NextResponse.json(extractedData);
  } catch (error) {
    console.error("Error in PDF extraction API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
