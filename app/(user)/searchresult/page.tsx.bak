"use client";

import { Document } from "@/component/model/interface/Document";
import {
  ChatRequestBody,
  Message,
} from "@/component/model/types/ChatRequestBody";
import { StreamMessageType } from "@/component/model/types/StreamMessage";
import { createSSEParser } from "@/lib/createSSEParser";
import {
  getIsDocumentNumberSelected,
  getIsMessageSend,
  getTrimMessages,
  setIsMessageSend,
} from "@/redux/storageSlice";

import React, {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid"; // Import UUID for generating unique IDs
import DocumentManagementUI from "@/component/ui/DocumentManagement/DocumentManagementUI";
import SearchResultComponent from "@/component/searchResultComponent/SearchResultComponent";
import DocumentsLoadingAnimation from "@/component/ui/DocumentsLoadingAnimation";
import { GroupedDocument } from "@/component/model/interface/GroupedDocument";
import { extractDocumentsFromOutput } from "@/lib/extractDocumentsFromOutput";
import RecentMessagesComponent from "@/components/templates/RecentMessagesComponent/RecentMessagesComponent";

interface AssistantMessage extends Message {
  _id: string;
  chatId: string;
  createdAt: number;
  isStreaming: boolean;
}

// Define proper interfaces for the MLDocuments message structure
interface MLDocumentsKwargs {
  content: string;
  // Add other properties if they exist
}

interface MLDocumentsOutput {
  kwargs?: MLDocumentsKwargs;
  // Add other properties that might exist in the output
}

interface MLDocumentsMessage {
  type: StreamMessageType.MLDocuments;
  tool: string;
  output: MLDocumentsOutput;
}

const SearchResultPage = () => {
  const sendMessage = useSelector(getIsMessageSend);
  const dispatch = useDispatch();
  const isDocumentNumberSelected = useSelector(getIsDocumentNumberSelected);
  const trimMessage = useSelector(getTrimMessages);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // const [isDocumentNumberSelected, setIsDocumentNumberSelected] =
  //   useState<boolean>(false);

  // Create rotating status messages
  const searchingStatuses = ["Processing relevant documents..."];

  const [messages, setMessages] = useState<Message[]>([]);
  const hasSearched = useRef(false); // 👈 track if handleSearch was already run
  const [input, setInput] = useState<string | number>(trimMessage || "");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [streamingResponse, setStreamingResponse] = useState<string>("");
  const [currentTool, setCurrentTool] = useState<{
    name: string;
    input: unknown;
  } | null>(null);

  const [isFindingDocuments, setIsFindingDocuments] = useState<boolean>(false);

  // Keep track of active tool executions
  const toolExecutionStack = useRef<string[]>([]);

  // To track whether a terminal output is currently displayed
  const isTerminalOutputDisplayed = useRef(false);

  const [allRelevantPDFList, setAllRelevantPDFList] = useState<
    GroupedDocument[]
  >([]);

  const [noRelevantPDFListsFound, setNoRelevantPDFListsFound] =
    useState<boolean>(false);

  const [statusIndex, setStatusIndex] = useState(0);

  let accumulatedTextWithDocs = ""; // includes doc lines (with URLs)

  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingResponse]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setStatusIndex((prevIndex) => (prevIndex + 1) % searchingStatuses.length);
    }, 5000); // every 5 seconds

    return () => clearInterval(intervalId); // cleanup on unmount
  }, [searchingStatuses.length]);

  const formatTerminalOutput = (message?: string) => {
    // Always use the provided message or the first status message
    const statusMessage = message || searchingStatuses[statusIndex];

    const terminalHtml = `
    <div class="flex justify-start animate-in fade-in-0 items-center">
        <div class="flex items-center gap-1.5">
            ${[0.3, 0.15, 0]
              .map(
                (delay, i) =>
                  `<div
                key="${i}"
                class="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce"
                style="animation-delay: ${delay}s"
              ></div>`
              )
              .join("")}
        </div>
         <div class="text-start text-sm text-gray-600">
           ${statusMessage}
         </div>                    
      </div>
     `;

    return `----START----\n${terminalHtml}\n----END----`;
  };

  const processStream = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onChunk: (chunk: string) => Promise<void>
  ) => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // await onChunk(new TextDecoder().decode(value));
        const chunkString = new TextDecoder().decode(value);

        await onChunk(chunkString);
        // console.log("onChunk", onChunk);
      }
    } finally {
      reader.releaseLock();
    }
  };

  const [isDocumentLoadingDone, setIsDocumentLoadingDone] =
    useState<boolean>(false);

  // this useeffect listen of there is no documents found in pinecone
  useEffect(() => {
    if (isDocumentLoadingDone) {
      if (allRelevantPDFList.length === 0) {
        if (!isFindingDocuments) {
          setNoRelevantPDFListsFound(true);
          setTimeout(() => {}, 10000);
        }
      } else {
        setNoRelevantPDFListsFound(false);
      }
    }
  }, [
    allRelevantPDFList.length,
    allRelevantPDFList,
    isFindingDocuments,
    isDocumentLoadingDone,
  ]);

  // const clearSearchHandler = async () => {
  //   try {
  //     setMessages([]);
  //     dispatch(setIsMessageSend(false));

  //     setAllRelevantPDFList([]);
  //   } catch (error) {
  //     console.log("Error", error);
  //   }
  // };

  const searchHandler = async (e?: FormEvent) => {
    e?.preventDefault();
    setIsFindingDocuments(true);
    dispatch(setIsMessageSend(true));
    const trimmedInput =
      typeof input === "string" ? input.trim() : input.toString().trim();
    if (!trimmedInput || isLoading) return;

    // setAllRelevantPDFList([]);

    const chatId = uuidv4();
    // Reset UI state for new message
    setInput("");
    setStreamingResponse("");
    setCurrentTool(null);
    setIsLoading(true);

    const userMessage: AssistantMessage = {
      _id: `user_${Date.now()}`,
      chatId,
      content: trimmedInput,
      role: "user",
      isStreaming: true,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);

    let fullResponse = "";
    try {
      const requestBody: ChatRequestBody = {
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        chatId,
        isDocumentNumberSelected: isDocumentNumberSelected,
        newMessage: trimmedInput,
      };

      // Initialize SSE connection
      const response = await fetch("api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error(await response.text());
      if (!response.body) throw new Error("No response body available");

      // --------(start) Handle stream ------------
      const parser = createSSEParser();
      const reader = response.body.getReader();

      // Process the stream chunks
      await processStream(reader, async (chunk) => {
        const messages = parser.parse(chunk);

        // Handle each message based on its type
        for (const message of messages) {
          switch (message.type) {
            case StreamMessageType.Token:
              // Handle streaming tokens (normal text response)
              if ("token" in message) {
                const tokenContent = message.token;
                accumulatedTextWithDocs += tokenContent;

                // 4. Accumulate cleaned version
                fullResponse = accumulatedTextWithDocs;
                setStreamingResponse(fullResponse);
              }
              break;

            case StreamMessageType.ToolStart:
              // Handle start of tool execution
              if ("tool" in message) {
                setCurrentTool({
                  name: message.tool,
                  input: message.input,
                });

                // Add tool to execution stack
                toolExecutionStack.current.push(message.tool);

                // Only add terminal output if not already displayed
                if (!isTerminalOutputDisplayed.current) {
                  const statusMessage = searchingStatuses[0]; // Use first message for consistency
                  const toolStartOutput = formatTerminalOutput(statusMessage);

                  fullResponse += toolStartOutput;
                  setStreamingResponse(fullResponse);
                  isTerminalOutputDisplayed.current = true;
                }
              }
              break;

            case StreamMessageType.MLDocuments:
              if ("tool" in message) {
                // Access the content from the nested structure
                const mlMessage = message as MLDocumentsMessage;
                const output = mlMessage.output;

                // Method 1: Direct access if you know the structure
                if (output?.kwargs?.content) {
                  // Extract and save documents to state
                  const { updatedDocs } = extractDocumentsFromOutput(output);

                  if (updatedDocs && updatedDocs.length > 0) {
                    // For setAllRelevantPDFList, use only the updatedDocs (latest documents)
                    setAllRelevantPDFList(() => {
                      // First, create a map of ML documents by their numeric ID
                      const mlTitleMap = new Map<string, string>();

                      updatedDocs.forEach((doc: Document) => {
                        if (doc.category === "AE" && doc.id) {
                          // Extract numeric ID from ML document (e.g., "635" from "635ML-Title")
                          const idString = String(doc.documentNumber);
                          const numericIdMatch = idString;

                          if (numericIdMatch && doc.title) {
                            const numericId = numericIdMatch;
                            mlTitleMap.set(numericId, doc.title);
                          }
                        }
                      });

                      // Create a map to group documents by title using only the latest updatedDocs
                      const groupedMap = new Map<string, GroupedDocument>();

                      // First pass: Group documents by title and collect all categories/keys per title
                      const titleGroups = new Map<
                        string,
                        {
                          title: string;
                          description: string;
                          documentNumber: string;
                          mostUsefulFor: string[];
                          id: string | number;
                          categories: Set<string>;
                          keys: Set<string>;
                        }
                      >();

                      updatedDocs.forEach((doc: Document) => {
                        let titleToUse = doc.title;

                        // For CL and DK documents, try to use ML title if available
                        if (
                          (doc.category === "CL" ||
                            doc.category === "DK" ||
                            doc.category === "FF" ||
                            doc.category === "ML") &&
                          doc.documentNumber
                        ) {
                          // Extract numeric ID from CL/DK document (e.g., "635" from "635CL-Title" or "635DK-Title")
                          const idString = String(doc.documentNumber);
                          const numericIdMatch = idString;

                          if (numericIdMatch) {
                            const numericId = numericIdMatch;

                            const mlTitle = mlTitleMap.get(numericId);
                            if (mlTitle) {
                              titleToUse = mlTitle; // Use ML title instead of CL/DK title
                            }
                          }
                        }

                        const titleKey = titleToUse.toLowerCase();

                        if (!titleGroups.has(titleKey)) {
                          titleGroups.set(titleKey, {
                            title: titleToUse || "",
                            description: doc.description || "",
                            documentNumber: doc.documentNumber || "",
                            mostUsefulFor: doc.mostUsefulFor || [],
                            id: doc.id || "",
                            categories: new Set(),
                            keys: new Set(),
                          });
                        }

                        const group = titleGroups.get(titleKey)!;

                        // Add category (including empty string if category is missing)
                        group.categories.add(doc.category || "");

                        // Add key (including empty string if key is missing)
                        group.keys.add(doc.key || "");
                      });

                      // Second pass: Convert to final format with all expected categories
                      const expectedCategories = ["ML", "CL", "DK", "FF", "AE"];

                      titleGroups.forEach((group, titleKey) => {
                        // Create arrays with empty strings for missing categories
                        const categoryArray: string[] = [];
                        const keyArray: string[] = [];

                        expectedCategories.forEach((expectedCat) => {
                          if (group.categories.has(expectedCat)) {
                            categoryArray.push(expectedCat);
                            // Find corresponding key for this category from original docs
                            const docWithCategory = updatedDocs.find(
                              (doc) =>
                                doc.category === expectedCat &&
                                (doc.title?.toLowerCase() === titleKey ||
                                  mlTitleMap
                                    .get(String(doc.documentNumber))
                                    ?.toLowerCase() === titleKey)
                            );
                            keyArray.push(docWithCategory?.key || "");
                          } else {
                            categoryArray.push("");
                            keyArray.push("");
                          }
                        });

                        groupedMap.set(titleKey, {
                          title: group.title,
                          key: keyArray,
                          description: group.description,
                          documentNumber: group.documentNumber,
                          mostUsefulFor: group.mostUsefulFor || [],
                          id: group.id,
                          category: categoryArray,
                        });
                      });

                      // Convert map back to array - this will only contain the latest documents
                      return Array.from(groupedMap.values());
                    });

                    // setDocuments(updatedDocs);
                  }
                }

                // Remove tool from execution stack
                const toolIndex = toolExecutionStack.current.indexOf(
                  message.tool
                );
                if (toolIndex !== -1) {
                  toolExecutionStack.current.splice(toolIndex, 1);
                }
              }

              break;

            case StreamMessageType.ToolEnd:
              // Handle completion of tool execution
              if ("tool" in message && currentTool) {
                // Extract allDocuments from the output

                setIsFindingDocuments(false);

                // Remove tool from execution stack
                const toolIndex = toolExecutionStack.current.indexOf(
                  message.tool
                );
                if (toolIndex !== -1) {
                  toolExecutionStack.current.splice(toolIndex, 1);
                }

                return;
              }
              break;

            case StreamMessageType.Error:
              if ("error" in message) {
                setIsFindingDocuments(false);
                setStreamingResponse("");
                const errorMessage: AssistantMessage = {
                  _id: `error_${Date.now()}`,
                  chatId,
                  content:
                    "Message Overloaded try to refresh the page then wait for a few minutes then try again! Thanks",
                  role: "assistant",
                  isStreaming: false,
                  createdAt: Date.now(),
                };

                setMessages((prev) => [...prev, errorMessage]);

                throw new Error(message.error);
              }
              break;

            case StreamMessageType.Done:
              // Process the fullResponse to display only title and description
              const processedResponse = fullResponse;
              setIsDocumentLoadingDone(true);
              setIsFindingDocuments(false);

              // Add the final assistant message to the messages array
              const assistantMessage: AssistantMessage = {
                _id: `assistant${Date.now()}`,
                chatId,
                content: processedResponse, // Use the processed response showing only title and description
                role: "assistant",
                isStreaming: false,
                createdAt: Date.now(),
              };

              // Replace the streaming message with the complete message
              setMessages((prev) => {
                // Remove the last message if it's the streaming placeholder
                const messagesWithoutStreaming = [...prev];

                // Add the complete assistant message
                messagesWithoutStreaming.push(assistantMessage);

                return messagesWithoutStreaming;
              });

              setStreamingResponse("");

              return;
          }
        }
      });
      // --------(end) Handle stream ------------
    } catch (error) {
      console.log("Error", error);
      // Handle any error during streaming
      setIsFindingDocuments(false);
      // Add an error message
      const errorMessage: AssistantMessage = {
        _id: `error_${Date.now()}`,
        chatId,
        content:
          "An error occurred while processing your request. Please try again.",
        role: "assistant",
        isStreaming: false,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsFindingDocuments(false);
    }
  };

  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Check if we came from hero section (not a page refresh)
    const cameFromHero = localStorage.getItem("cameFromHero");

    // Call searchHandler if we have a trimMessage, haven't searched yet, and came from hero
    if (!hasSearched.current && trimMessage && cameFromHero === "true") {
      // setInput(trimMessage); // Set the input to show the search term

      setTimeout(() => {
        setIsFindingDocuments(true);
        hasSearched.current = true; // ✅ prevent future runs
        searchHandler();
        // Clear the flag after using it
        localStorage.removeItem("cameFromHero");
      }, 1000);
    }
  }, [searchHandler, trimMessage]);

  return (
    <div className=" w-full flex-col flex items-center px-5 h-screen">
      {/* <div className="w-full flex flex-col items-center py-16"> */}
      {!sendMessage ? (
        <SearchResultComponent
          input={input}
          setInput={setInput}
          searchHandler={searchHandler}
        />
      ) : (
        <div className="w-full flex flex-col items-center lg:px-20">
          <RecentMessagesComponent
            className="flex items-center rounded-full w-full lg:w-4xl border gap-3 border-gray-300 bg-white shadow-sm hover:shadow transition-shadow p-1"
            messages={messages} // Pass the entire array here
            input={input}
            setInput={setInput}
            searchHandler={searchHandler}
          />

          <h1 className="text-6xl font-playfair py-10">Documents List</h1>
          {noRelevantPDFListsFound ? (
            <>No documents results found. Please try again!</>
          ) : (
            <></>
          )}
          {isFindingDocuments ? (
            <DocumentsLoadingAnimation />
          ) : (
            <DocumentManagementUI documents={allRelevantPDFList} />
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResultPage;
