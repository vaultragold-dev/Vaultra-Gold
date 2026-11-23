// Lightweight in-app translations (English, Hindi, Gujarati, Marathi). Picked from the side menu / profile.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "en" | "hi" | "gu" | "mr";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "mr", label: "Marathi", native: "मराठी" },
];

type Dict = Record<string, string>;

const en: Dict = {
  home: "Home", vault: "Vault", jewellery: "Jewellery", sip: "SIP",
  my_vault: "My Vault & Redeem", catalogue: "Jewellery Catalogue", auto_sip: "Auto SIP", refer_earn: "Refer & Earn",
  notifications: "Notifications", kyc_status: "KYC Status", help: "Help & FAQs", store_locator: "Store Locator",
  language: "Language", dark_mode: "Dark Mode", light_mode: "Light Mode", app_lock: "App Lock (MPIN / Biometric)",
  logout: "Logout", sign_in: "Sign In", hi: "Hi", on: "ON", off: "OFF", verified: "Verified", in_review: "In review", pending: "Pending",
  live_rate: "Live Rate", rates_paused: "Rates Paused", indicative_rate: "Indicative Rate", since_yesterday: "since yesterday",
  gold: "Gold", silver: "Silver", per_gram: "/gm", resumes: "Resumes when feed is back",
  shop_by_category: "Shop by Category", trending_jewellery: "Trending Jewellery", see_all: "See all",
  sip_eyebrow: "AUTO SIP", sip_title: "Save in gold every month from ₹500", sip_sub: "UPI AutoPay · Pause or cancel anytime",
  refer_title: "Refer & Earn", refer_sub: "Invite friends · You both earn a reward", faq: "Frequently asked questions",
  choose_language: "Choose language",
  // lock
  enter_mpin: "Enter your 4-digit MPIN", set_mpin: "Set a 4-digit MPIN", confirm_mpin: "Re-enter MPIN to confirm",
  mpin_mismatch: "MPINs do not match. Try again.", wrong_mpin: "Incorrect MPIN", use_biometric: "Use fingerprint / Face ID",
  forgot_mpin: "Forgot MPIN? Login with OTP", unlock_title: "Unlock your vault", mpin_set_done: "MPIN set successfully",
  secure_vault: "Secure your vault", mpin_hint: "You'll need this MPIN (or biometric) every time you open the app.",
  enable_biometric: "Unlock with fingerprint / Face ID", change_mpin: "Change MPIN", attempts_left: "attempts left",
  // store
  visit_store: "Visit our store", directions: "Get Directions", call_store: "Call Store", whatsapp: "WhatsApp",
  store_hours: "Store timings", address: "Address",
  // referral
  share_link: "Share Invite Link", have_code: "Have a friend's referral code?", apply: "Apply", your_link: "YOUR INVITE LINK",
};

const hi: Dict = {
  home: "होम", vault: "वॉल्ट", jewellery: "ज्वेलरी", sip: "SIP",
  my_vault: "मेरा वॉल्ट और रिडीम", catalogue: "ज्वेलरी कैटलॉग", auto_sip: "ऑटो SIP", refer_earn: "रेफ़र करें और कमाएँ",
  notifications: "सूचनाएँ", kyc_status: "KYC स्थिति", help: "सहायता और FAQs", store_locator: "स्टोर लोकेटर",
  language: "भाषा", dark_mode: "डार्क मोड", light_mode: "लाइट मोड", app_lock: "ऐप लॉक (MPIN / बायोमेट्रिक)",
  logout: "लॉगआउट", sign_in: "साइन इन", hi: "नमस्ते", on: "चालू", off: "बंद", verified: "सत्यापित", in_review: "समीक्षा में", pending: "लंबित",
  live_rate: "लाइव रेट", rates_paused: "रेट रुके हैं", indicative_rate: "सांकेतिक रेट", since_yesterday: "कल से",
  gold: "सोना", silver: "चांदी", per_gram: "/ग्राम", resumes: "फ़ीड वापस आने पर शुरू होगा",
  shop_by_category: "श्रेणी अनुसार खरीदें", trending_jewellery: "ट्रेंडिंग ज्वेलरी", see_all: "सभी देखें",
  sip_eyebrow: "ऑटो SIP", sip_title: "हर महीने ₹500 से सोने में बचत करें", sip_sub: "UPI ऑटोपे · कभी भी रोकें या रद्द करें",
  refer_title: "रेफ़र करें और कमाएँ", refer_sub: "दोस्तों को बुलाएँ · दोनों को इनाम मिलेगा", faq: "अक्सर पूछे जाने वाले प्रश्न",
  choose_language: "भाषा चुनें",
  enter_mpin: "अपना 4-अंकों का MPIN डालें", set_mpin: "4-अंकों का MPIN सेट करें", confirm_mpin: "पुष्टि के लिए MPIN दोबारा डालें",
  mpin_mismatch: "MPIN मेल नहीं खाते। फिर से कोशिश करें।", wrong_mpin: "गलत MPIN", use_biometric: "फ़िंगरप्रिंट / फ़ेस ID का उपयोग करें",
  forgot_mpin: "MPIN भूल गए? OTP से लॉगिन करें", unlock_title: "अपना वॉल्ट अनलॉक करें", mpin_set_done: "MPIN सफलतापूर्वक सेट हुआ",
  secure_vault: "अपना वॉल्ट सुरक्षित करें", mpin_hint: "ऐप खोलते समय हर बार यह MPIN (या बायोमेट्रिक) चाहिए होगा।",
  enable_biometric: "फ़िंगरप्रिंट / फ़ेस ID से अनलॉक", change_mpin: "MPIN बदलें", attempts_left: "प्रयास बाकी",
  visit_store: "हमारे स्टोर पर आएँ", directions: "रास्ता देखें", call_store: "स्टोर को कॉल करें", whatsapp: "व्हाट्सऐप",
  store_hours: "स्टोर समय", address: "पता",
  share_link: "इनवाइट लिंक शेयर करें", have_code: "दोस्त का रेफ़रल कोड है?", apply: "लागू करें", your_link: "आपका इनवाइट लिंक",
};

const gu: Dict = {
  home: "હોમ", vault: "વૉલ્ટ", jewellery: "જ્વેલરી", sip: "SIP",
  my_vault: "મારું વૉલ્ટ અને રિડીમ", catalogue: "જ્વેલરી કેટલોગ", auto_sip: "ઓટો SIP", refer_earn: "રેફર કરો અને કમાઓ",
  notifications: "સૂચનાઓ", kyc_status: "KYC સ્થિતિ", help: "મદદ અને FAQs", store_locator: "સ્ટોર લોકેટર",
  language: "ભાષા", dark_mode: "ડાર્ક મોડ", light_mode: "લાઇટ મોડ", app_lock: "એપ લૉક (MPIN / બાયોમેટ્રિક)",
  logout: "લૉગઆઉટ", sign_in: "સાઇન ઇન", hi: "નમસ્તે", on: "ચાલુ", off: "બંધ", verified: "ચકાસાયેલ", in_review: "સમીક્ષામાં", pending: "બાકી",
  live_rate: "લાઇવ રેટ", rates_paused: "રેટ અટક્યા છે", indicative_rate: "સૂચક રેટ", since_yesterday: "ગઈકાલથી",
  gold: "સોનું", silver: "ચાંદી", per_gram: "/ગ્રામ", resumes: "ફીડ પાછી આવે ત્યારે શરૂ થશે",
  shop_by_category: "કેટેગરી મુજબ ખરીદો", trending_jewellery: "ટ્રેન્ડિંગ જ્વેલરી", see_all: "બધું જુઓ",
  sip_eyebrow: "ઓટો SIP", sip_title: "દર મહિને ₹500 થી સોનામાં બચત કરો", sip_sub: "UPI ઓટોપે · ગમે ત્યારે રોકો અથવા રદ કરો",
  refer_title: "રેફર કરો અને કમાઓ", refer_sub: "મિત્રોને આમંત્રિત કરો · બંનેને ઇનામ મળશે", faq: "વારંવાર પૂછાતા પ્રશ્નો",
  choose_language: "ભાષા પસંદ કરો",
  enter_mpin: "તમારો 4-અંકનો MPIN દાખલ કરો", set_mpin: "4-અંકનો MPIN સેટ કરો", confirm_mpin: "ખાતરી માટે MPIN ફરી દાખલ કરો",
  mpin_mismatch: "MPIN મેળ ખાતા નથી. ફરી પ્રયાસ કરો.", wrong_mpin: "ખોટો MPIN", use_biometric: "ફિંગરપ્રિન્ટ / ફેસ ID વાપરો",
  forgot_mpin: "MPIN ભૂલી ગયા? OTP થી લૉગિન કરો", unlock_title: "તમારું વૉલ્ટ અનલૉક કરો", mpin_set_done: "MPIN સફળતાપૂર્વક સેટ થયો",
  secure_vault: "તમારું વૉલ્ટ સુરક્ષિત કરો", mpin_hint: "એપ ખોલતી વખતે દર વખતે આ MPIN (અથવા બાયોમેટ્રિક) જોઈશે.",
  enable_biometric: "ફિંગરપ્રિન્ટ / ફેસ ID થી અનલૉક", change_mpin: "MPIN બદલો", attempts_left: "પ્રયાસ બાકી",
  visit_store: "અમારા સ્ટોરની મુલાકાત લો", directions: "રસ્તો જુઓ", call_store: "સ્ટોરને કૉલ કરો", whatsapp: "વોટ્સએપ",
  store_hours: "સ્ટોર સમય", address: "સરનામું",
  share_link: "ઇન્વાઇટ લિંક શેર કરો", have_code: "મિત્રનો રેફરલ કોડ છે?", apply: "લાગુ કરો", your_link: "તમારી ઇન્વાઇટ લિંક",
};

const mr: Dict = {
  home: "होम", vault: "व्हॉल्ट", jewellery: "दागिने", sip: "SIP",
  my_vault: "माझे व्हॉल्ट आणि रिडीम", catalogue: "दागिने कॅटलॉग", auto_sip: "ऑटो SIP", refer_earn: "रेफर करा आणि कमवा",
  notifications: "सूचना", kyc_status: "KYC स्थिती", help: "मदत आणि FAQs", store_locator: "स्टोअर लोकेटर",
  language: "भाषा", dark_mode: "डार्क मोड", light_mode: "लाइट मोड", app_lock: "ॲप लॉक (MPIN / बायोमेट्रिक)",
  logout: "लॉगआउट", sign_in: "साइन इन", hi: "नमस्कार", on: "चालू", off: "बंद", verified: "पडताळलेले", in_review: "पुनरावलोकनात", pending: "प्रलंबित",
  live_rate: "लाइव्ह दर", rates_paused: "दर थांबले", indicative_rate: "सूचक दर", since_yesterday: "कालपासून",
  gold: "सोने", silver: "चांदी", per_gram: "/ग्रॅम", resumes: "फीड परत आल्यावर सुरू होईल",
  shop_by_category: "श्रेणीनुसार खरेदी", trending_jewellery: "ट्रेंडिंग दागिने", see_all: "सर्व पहा",
  sip_eyebrow: "ऑटो SIP", sip_title: "दर महिन्याला ₹500 पासून सोन्यात बचत करा", sip_sub: "UPI ऑटोपे · कधीही थांबवा किंवा रद्द करा",
  refer_title: "रेफर करा आणि कमवा", refer_sub: "मित्रांना आमंत्रित करा · दोघांनाही बक्षीस", faq: "वारंवार विचारले जाणारे प्रश्न",
  choose_language: "भाषा निवडा",
  enter_mpin: "तुमचा 4-अंकी MPIN टाका", set_mpin: "4-अंकी MPIN सेट करा", confirm_mpin: "खात्रीसाठी MPIN पुन्हा टाका",
  mpin_mismatch: "MPIN जुळत नाहीत. पुन्हा प्रयत्न करा.", wrong_mpin: "चुकीचा MPIN", use_biometric: "फिंगरप्रिंट / फेस ID वापरा",
  forgot_mpin: "MPIN विसरलात? OTP ने लॉगिन करा", unlock_title: "तुमचे व्हॉल्ट अनलॉक करा", mpin_set_done: "MPIN यशस्वीरित्या सेट झाला",
  secure_vault: "तुमचे व्हॉल्ट सुरक्षित करा", mpin_hint: "ॲप उघडताना प्रत्येक वेळी हा MPIN (किंवा बायोमेट्रिक) लागेल.",
  enable_biometric: "फिंगरप्रिंट / फेस ID ने अनलॉक", change_mpin: "MPIN बदला", attempts_left: "प्रयत्न शिल्लक",
  visit_store: "आमच्या स्टोअरला भेट द्या", directions: "दिशा पहा", call_store: "स्टोअरला कॉल करा", whatsapp: "व्हॉट्सॲप",
  store_hours: "स्टोअरची वेळ", address: "पत्ता",
  share_link: "इन्व्हाइट लिंक शेअर करा", have_code: "मित्राचा रेफरल कोड आहे?", apply: "लागू करा", your_link: "तुमची इन्व्हाइट लिंक",
};

const DICTS: Record<Lang, Dict> = { en, hi, gu, mr };
let current: Lang = "en";

/** Translate a key in the current language (falls back to English, then the key itself). */
export function t(key: string): string {
  return DICTS[current][key] ?? en[key] ?? key;
}

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });
const KEY = "app_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v && v in DICTS) {
        current = v as Lang;
        setLangState(v as Lang);
      }
    }).catch(() => {});
  }, []);
  const setLang = useCallback((l: Lang) => {
    current = l;
    AsyncStorage.setItem(KEY, l).catch(() => {});
    setLangState(l);
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return React.createElement(LangCtx.Provider, { value }, children);
}

export function useLang() {
  return useContext(LangCtx);
}
