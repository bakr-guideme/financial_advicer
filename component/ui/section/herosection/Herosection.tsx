"use client";

import SearchInputComponent from "@/components/templates/SearchInputComponent/SearchInputComponent";
import { setIsMessageSend, setTrimMessages } from "@/redux/storageSlice";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { FormEvent, Fragment, useState } from "react";
import { useDispatch } from "react-redux";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

const businessTools = [
  { name: "Division 7A Analyser", href: "/tools/div7a-analyser", desc: "Loan strategy & retirement planning", icon: "⚖️" },
  { name: "Budget Builder", href: "/tools/budget-builder-myob", desc: "MYOB export to formatted budget", icon: "📊" },
];

const Herosection = () => {
  const dispatch = useDispatch();
  const route = useRouter();
  const [input, setInput] = useState<string | number>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmedInput = typeof input === "string" ? input : input.toString();
    localStorage.setItem("cameFromHero", "true");
    dispatch(setIsMessageSend(true));
    dispatch(setTrimMessages(trimmedInput));
    route.push("/searchresult");
  };

  return (
    <>
      {/* ── Public Navigation Bar ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex-shrink-0">
              <Link href="/">
                <Image alt="BAKR" src="https://res.cloudinary.com/dmz8tsndt/image/upload/v1755063722/BAKR_New_Logo-01_fldmxk.svg" width={120} height={48} className="h-10 w-auto" />
              </Link>
            </div>

            <div className="hidden md:flex md:items-center md:gap-x-2">
              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center gap-x-1 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                  Business Tools
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </Menu.Button>
                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                  <Menu.Items className="absolute left-0 z-10 mt-2 w-72 origin-top-left rounded-xl bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Calculators &amp; Tools</p>
                    </div>
                    {businessTools.map((tool) => (
                      <Menu.Item key={tool.name}>
                        {({ active }) => (
                          <Link href={tool.href} className={`flex items-start gap-3 px-4 py-3 transition-colors ${active ? "bg-gray-50" : ""}`}>
                            <span className="text-lg mt-0.5">{tool.icon}</span>
                            <div>
                              <p className={`text-sm font-medium ${active ? "text-gray-900" : "text-gray-700"}`}>{tool.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{tool.desc}</p>
                            </div>
                          </Link>
                        )}
                      </Menu.Item>
                    ))}
                  </Menu.Items>
                </Transition>
              </Menu>

              <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">Sign in</Link>
              <Link href="/register" className="rounded-lg bg-[#1F4E79] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E75B6] transition-colors">Get started</Link>
            </div>

            <div className="flex md:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-lg p-2 text-gray-700 hover:bg-gray-100">
                <span className="sr-only">Open menu</span>
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1">
            <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Business Tools</p>
            {businessTools.map((tool) => (
              <Link key={tool.name} href={tool.href} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <span>{tool.icon}</span>
                <div>
                  <p className="font-medium">{tool.name}</p>
                  <p className="text-xs text-gray-400">{tool.desc}</p>
                </div>
              </Link>
            ))}
            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Sign in</Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg bg-[#1F4E79] px-3 py-2 text-sm font-semibold text-white text-center hover:bg-[#2E75B6]">Get started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Content (unchanged) ── */}
      <div className="relative overflow-hidden flex flex-col items-center md:items-start md:flex-row w-full max-h-screen px-7 lg:px-0">
        <div className="w-0 lg:w-[21.7%] relative pointer-events-none flex-shrink-0">
          <div className="relative top-20 h-full w-full aspect-square opacity-0 lg:opacity-100">
            <Image src="https://res.cloudinary.com/dmz8tsndt/image/upload/e_sharpen:100/leftImage_ywd3lt" alt="Image Right" className="object-contain" width={800} height={800} />
          </div>
        </div>

        <div className="w-full 2xl:px-0 lg:px-10 2xl:w-[57%] relative lg:h-[35rem] xl:h-[40rem] 2xl:h-[55rem] z-10 flex flex-col mt-10 lg:mt-0 lg:justify-center gap-10">
          <hr className="bg-[#1C1B1A] w-full h-[3px] transform 2xl:-translate-y-28 max-w-4xl mx-auto" />
          <div className="text-center w-full transform 2xl:-translate-y-20">
            <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-playfair text-black mb-8 xl:mb-10 tracking-tight">Financial Information at your fingertips.</h1>
            <h2 className="text-2xl 2xl:text-4xl text-black font-normal font-playfair mb-6 2xl:mb-12 tracking-tight">Wherever you are in life, we're here to help!</h2>
            <div className="relative max-w-4xl mx-auto mb-8">
              <SearchInputComponent className="flex items-center rounded-full border gap-3 border-gray-300 bg-white shadow-sm hover:shadow transition-shadow px-2" input={input} setInput={setInput} searchHandler={(e) => handleSearch(e)} />
            </div>
            <p className="text-[#1C1B1A] lg:text-[15px] max-w-md mx-auto leading-relaxed">Describe your situation in the field above and we'll search<br />for some information to help you right away!</p>
            <hr className="bg-[#1C1B1A] w-full h-[3px] max-w-4xl mx-auto my-10 2xl:mt-20" />
          </div>
        </div>

        <div className="w-0 lg:w-[21.7%] relative pointer-events-none flex-shrink-0">
          <div className="relative top-20 h-full w-full aspect-square opacity-0 lg:opacity-100">
            <Image src="https://res.cloudinary.com/dmz8tsndt/image/upload/v1756248916/rightImage_dwu1jt.png" alt="Image Left" className="object-contain" width={800} height={800} />
          </div>
        </div>
      </div>
    </>
  );
};

export default Herosection;
