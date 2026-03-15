"use client";

import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { TopNavigationModel } from "@/component/model/interface/TopNavigationModel";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { UserNameListType } from "@/component/model/types/UserNameListType";
import Cookies from "js-cookie";
import { useDispatch, useSelector } from "react-redux";
import { getisLogin, setUserNameLists } from "@/redux/storageSlice";
import { getUserLocalStorage } from "@/functions/function";
import ToasterComponent from "@/components/templates/ToastMessageComponent/ToastMessageComponent";
import { jwtDecode } from "jwt-decode";
import { TokenModel } from "@/component/model/interface/TokenModel";

const businessTools = [
  { name: "Division 7A Analyser", href: "/tools/div7a-analyser", desc: "Loan strategy & retirement planning" },
  { name: "Budget Builder", href: "/tools/budget-builder-myob", desc: "MYOB export to formatted budget" },
];

const guideMeQuizzes = [
  { name: "Estate Planning", href: "/guideme/estate-planning", desc: "Personalised estate planning assessment" },
];

const TopNavigationComponent = (props: TopNavigationModel) => {
  const route = useRouter();
  const dispatch = useDispatch();
  const userLogin = useSelector(getisLogin);

  const [userData, setUserData] = useState<UserNameListType | null>(null);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [toastType, setToastType] = useState<ToastType>("success");
  const [isUserExpired, setIsUserExpired] = useState<boolean>(false);

  const handleSignOut = () => {
    Cookies.remove("auth_token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userDatas");
    localStorage.removeItem("userRole");
    dispatch(setUserNameLists({ email: "", name: "", interval: "", photoUrl: "", accessToken: "", id: "", userRole: "" }));
    setUserData(null);
    if (isUserExpired) {
      setMessage("Session timed out. Please log in again.");
      setToastType("warning");
      setTitle("Session Expired");
      setShowToast(true);
      setTimeout(() => { setShowToast(false); route.push("/login"); }, 2000);
    } else {
      setMessage("Successfully Sign out");
      setToastType("success");
      setTitle("Well Done");
      setShowToast(true);
      setTimeout(() => { setShowToast(false); route.push("/login"); }, 3000);
    }
  };

  useEffect(() => { if (isUserExpired) { handleSignOut(); return; } }, [isUserExpired, handleSignOut]);

  useEffect(() => {
    if (!userData) return;
    const checkCookieSession = () => {
      const authToken = Cookies.get("auth_token");
      if (!authToken) { setIsUserExpired(true); return; }
      try { const userDatas: TokenModel = jwtDecode(authToken); console.log("userDatas", userDatas); }
      catch (error) { console.error("Invalid token, logging out...", error); handleSignOut(); }
    };
    checkCookieSession();
    const intervalId = setInterval(checkCookieSession, 30000);
    return () => clearInterval(intervalId);
  }, [userData]);

  useEffect(() => {
    const storedUserData = getUserLocalStorage();
    setUserData(storedUserData);
    if (storedUserData) { dispatch(setUserNameLists(storedUserData)); }
  }, [dispatch, userLogin]);

  return (
    <>
      <ToasterComponent isOpen={showToast} title={title} message={message} onClose={setShowToast} type={toastType} duration={3000} autoClose={true} />

      <div className="sticky top-0 z-50 flex h-auto p-6 shrink-0 items-center gap-x-4 border-b border-gray-200 px-4 shadow-sm bg-white sm:gap-x-6 sm:px-6 lg:px-8">
        <div className="flex 2xl:flex-1">
          <Link href="/" className="-m-1.5 p-1.5">
            <span className="sr-only">Your Company</span>
            <Image alt="logo" src="https://res.cloudinary.com/dmz8tsndt/image/upload/v1755063722/BAKR_New_Logo-01_fldmxk.svg" className="w-40 h-16" width={200} height={200} />
          </Link>
        </div>
        <button type="button" className="-m-2.5 p-2.5 text-gray-700 2xl:hidden" onClick={() => props.setSidebarOpen?.(!props.sidebarOpen)}>
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <form className="relative flex flex-1" action="#" method="GET"></form>

          {/* ── Business Tools Dropdown ── */}
          <div className="hidden lg:flex lg:items-center">
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-x-1 rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                Business Tools
                <ChevronDownIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute left-0 z-10 mt-2 w-64 origin-top-left rounded-xl bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Calculators &amp; Tools</p>
                  </div>
                  {businessTools.map((tool) => (
                    <Menu.Item key={tool.name}>
                      {({ active }) => (
                        <Link
                          href={tool.href}
                          className={`block px-4 py-3 transition-colors ${active ? "bg-gray-50" : ""}`}
                        >
                          <p className={`text-sm font-medium ${active ? "text-gray-900" : "text-gray-700"}`}>{tool.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{tool.desc}</p>
                        </Link>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>
            </Menu>
          </div>

          {/* ── GuideMe Quizzes Dropdown ── */}
          <div className="hidden lg:flex lg:items-center">
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-x-1 rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                GuideMe Quizzes
                <ChevronDownIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute left-0 z-10 mt-2 w-64 origin-top-left rounded-xl bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Personalised Assessments</p>
                  </div>
                  {guideMeQuizzes.map((quiz) => (
                    <Menu.Item key={quiz.name}>
                      {({ active }) => (
                        <Link
                          href={quiz.href}
                          className={`block px-4 py-3 transition-colors ${active ? "bg-gray-50" : ""}`}
                        >
                          <p className={`text-sm font-medium ${active ? "text-gray-900" : "text-gray-700"}`}>{quiz.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{quiz.desc}</p>
                        </Link>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>
            </Menu>
          </div>

          <div className="flex items-center gap-x-4 lg:gap-x-6">
            <div className="hidden lg:block md:h-6 md:w-px md:bg-gray-200" aria-hidden="true" />
            <span className="text-sm text-gray-700">Admin</span>
            <div className="hidden lg:block md:h-6 md:w-px md:bg-gray-200" aria-hidden="true" />

            <Menu as="div" className="relative">
              <Menu.Button className="-m-1.5 flex items-center p-1.5">
                <span className="sr-only">Open user menu</span>
                {userData?.photoUrl && (
                  <div className="relative h-8 w-8 rounded-full overflow-hidden bg-gray-50">
                    <Image src={userData?.photoUrl} alt="User Avatar" fill className="object-cover" />
                  </div>
                )}
                <span className="hidden lg:flex lg:items-center">
                  <span className="ml-4 text-sm font-semibold leading-6 text-gray-900" aria-hidden="true">{userData?.name}</span>
                  <ChevronDownIcon className="ml-2 h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                  {props.userNavigation.map((item) => (
                    <Menu.Item key={item.name}>
                      {({ active }) => (
                        <span
                          onClick={() => { if (item.name === "Sign out") { handleSignOut(); } item.callback(); route.push(item.href); }}
                          className={`block px-3 py-1 text-sm leading-6 ${active ? "bg-gray-100 text-gray-900" : "text-gray-700"} cursor-pointer`}
                        >
                          {item.name}
                        </span>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </>
  );
};

export default TopNavigationComponent;
