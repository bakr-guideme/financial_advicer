"use client";

import { GroupedDocument } from "@/component/model/interface/GroupedDocument";
import {
  getIsMessageSend,
  getTrimMessages,
  setIsMessageSend,
} from "@/redux/storageSlice";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import DocumentManagementUI from "@/component/ui/DocumentManagement/DocumentManagementUI";
import SearchResultComponent from "@/component/searchResultComponent/SearchResultComponent";
import DocumentsLoadingAnimation from "@/component/ui/DocumentsLoadingAnimation";
import RecentMessagesComponent from "@/components/templates/RecentMessagesComponent/RecentMessagesComponent";
import { searchFirestoreDocuments } from "@/lib/firestoreSearch";

const SearchResultPage = () => {
  const sendMessage = useSelector(getIsMessageSend);
  const dispatch = useDispatch();
  const trimMessage = useSelector(getTrimMessages);
  const hasSearched = useRef(false);
  const hasRun = useRef(false);

  const [input, setInput] = useState<string | number>(trimMessage || "");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFindingDocuments, setIsFindingDocuments] = useState<boolean>(false);
  const [allRelevantPDFList, setAllRelevantPDFList] = useState<
    GroupedDocument[]
  >([]);
  const [noRelevantPDFListsFound, setNoRelevantPDFListsFound] =
    useState<boolean>(false);

  // ─── Simplified Firestore Search Handler ───
  const searchHandler = async (e?: FormEvent) => {
    e?.preventDefault();

    const trimmedInput =
      typeof input === "string" ? input.trim() : input.toString().trim();
    if (!trimmedInput || isLoading) return;

    setIsFindingDocuments(true);
    dispatch(setIsMessageSend(true));
    setIsLoading(true);
    setAllRelevantPDFList([]);
    setNoRelevantPDFListsFound(false);

    try {
      const results = await searchFirestoreDocuments(trimmedInput);

      // Cast to GroupedDocument (same shape)
      setAllRelevantPDFList(results as unknown as GroupedDocument[]);

      if (results.length === 0) {
        setNoRelevantPDFListsFound(true);
      }
    } catch (error) {
      console.error("Firestore search error:", error);
      setNoRelevantPDFListsFound(true);
    } finally {
      setIsLoading(false);
      setIsFindingDocuments(false);
    }
  };

  // Auto-search when arriving from hero section
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const cameFromHero = localStorage.getItem("cameFromHero");

    if (!hasSearched.current && trimMessage && cameFromHero === "true") {
      setTimeout(() => {
        setIsFindingDocuments(true);
        hasSearched.current = true;
        searchHandler();
        localStorage.removeItem("cameFromHero");
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimMessage]);

  return (
    <div className="w-full flex-col flex items-center px-5 h-screen">
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
            messages={[]}
            input={input}
            setInput={setInput}
            searchHandler={searchHandler}
          />

          <h1 className="text-6xl font-playfair py-10">Documents List</h1>

          {noRelevantPDFListsFound && (
            <div className="text-center py-8">
              <p className="text-lg text-gray-600">
                No matching documents found. Try describing your situation
                differently.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Example: &ldquo;I&apos;m getting married and buying a house&rdquo; or
                &ldquo;setting up a family trust&rdquo;
              </p>
            </div>
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
