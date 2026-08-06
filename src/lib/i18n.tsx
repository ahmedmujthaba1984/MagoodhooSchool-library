import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'dv';

export interface Translations {
  // App Header & Branding
  schoolPortal: string;
  schoolLibrary: string;
  liveSync: string;
  barcodeReader: string;
  directLink: string;
  admin: string;
  language: string;
  activeProfile: string;
  quickProfileSwitcher: string;
  registerParentAccount: string;
  directWebPortalLink: string;
  copyLink: string;
  copied: string;
  closeWindow: string;
  multiBrowserSupport: string;
  multiBrowserDesc: string;
  
  // Tabs
  catalog: string;
  aiLibrarian: string;
  reference: string;
  borrowingHistory: string;
  scanCheckout: string;
  adminInventory: string;
  memberDirectory: string;
  reportsTrends: string;
  faqHelp: string;
  lateReturns: string;
  parentPortal: string;

  // Search & Filters
  searchPlaceholder: string;
  allCategories: string;
  allTypes: string;
  circulating: string;
  referenceOnly: string;
  entriesPerPage: string;
  showing: string;
  to: string;
  of: string;
  entries: string;
  
  // Catalog Stats & Headers
  titles: string;
  physicalBooks: string;
  available: string;
  checkedOut: string;
  reserveBook: string;
  quickBorrow: string;
  details: string;
  viewMemberFile: string;
  catalogSubtitle: string;
  
  // Roles
  adminRole: string;
  studentRole: string;
  parentRole: string;
  staffRole: string;
  
  // Actions & Buttons
  addBook: string;
  importBulk: string;
  addParent: string;
  addStaff: string;
  logout: string;
  login: string;
  save: string;
  cancel: string;
  delete: string;
  confirm: string;
  printCard: string;
  close: string;
  exportCsv: string;
  
  // Member & Account labels
  studentId: string;
  staffId: string;
  department: string;
  phone: string;
  email: string;
  linkedChildren: string;
  activeLoans: string;
  membersCount: string;
  allMembers: string;
  students: string;
  parents: string;
  facultyStaff: string;
  searchMembersPlaceholder: string;
  
  // Borrowing / Loans
  dueDate: string;
  borrowedDate: string;
  returnedDate: string;
  status: string;
  overdue: string;
  active: string;
  returned: string;
  returnBook: string;
  renewLoan: string;
  daysRemaining: string;
  fineAmount: string;
  
  // Messages
  noBooksFound: string;
  searchEmptyHint: string;
  success: string;
  error: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    schoolPortal: 'MAGOODHOO SCHOOL PORTAL',
    schoolLibrary: 'Magoodhoo School Library',
    liveSync: 'Live Sync',
    barcodeReader: 'Barcode Reader',
    directLink: 'Direct Link',
    admin: 'Admin',
    language: 'Language / ބަސް',
    activeProfile: 'Active Profile:',
    quickProfileSwitcher: 'Quick Profile Switcher',
    registerParentAccount: '+ Register Parent Account',
    directWebPortalLink: 'Direct Web Portal Link',
    copyLink: 'Copy Link',
    copied: 'Copied!',
    closeWindow: 'Close Window',
    multiBrowserSupport: 'Multi-Browser Support',
    multiBrowserDesc: 'Open this link on any phone, tablet or browser to access Magoodhoo School Library.',
    
    catalog: 'Library Catalog',
    aiLibrarian: 'Smart Librarian',
    reference: 'Reference Books',
    borrowingHistory: 'Borrowing History',
    scanCheckout: 'Scan Checkout & Return',
    adminInventory: 'Admin & Inventory',
    memberDirectory: 'Member Directory',
    reportsTrends: 'Reports & Trends',
    faqHelp: 'FAQ / Help Desk',
    lateReturns: 'Late Returns Desk',
    parentPortal: 'Parent Portal',
    
    searchPlaceholder: 'Search titles, authors, ISBN, barcode, or subject shelf...',
    allCategories: 'All Categories',
    allTypes: 'All Types',
    circulating: 'Circulating Books',
    referenceOnly: 'Reference Only',
    entriesPerPage: 'entries per page',
    showing: 'Showing',
    to: 'to',
    of: 'of',
    entries: 'books',
    
    titles: 'Titles',
    physicalBooks: 'Physical Books',
    available: 'Available',
    checkedOut: 'Checked Out',
    reserveBook: 'Reserve Book',
    quickBorrow: 'Quick Borrow',
    details: 'Details',
    viewMemberFile: 'View Member File',
    catalogSubtitle: 'High-volume catalog portal supporting 9,000+ physical volumes and online reservations.',
    
    adminRole: 'Admin / Librarian',
    studentRole: 'Student Member',
    parentRole: 'Parent Account',
    staffRole: 'Faculty & Staff',
    
    addBook: 'Add New Book',
    importBulk: 'Bulk Import CSV',
    addParent: 'Add Parent',
    addStaff: 'Add Faculty/Staff',
    logout: 'Log Out',
    login: 'Login / Auth Portal',
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    printCard: 'Print Library Card',
    close: 'Close',
    exportCsv: 'Export to CSV',
    
    studentId: 'Student ID',
    staffId: 'Staff ID',
    department: 'Department / Faculty',
    phone: 'Phone',
    email: 'Email',
    linkedChildren: 'Linked Student Children',
    activeLoans: 'Active Book Loans',
    membersCount: 'Members',
    allMembers: 'All Members',
    students: 'Students',
    parents: 'Parents',
    facultyStaff: 'Faculty & Staff',
    searchMembersPlaceholder: 'Search members by name, email, student ID code, staff ID...',
    
    dueDate: 'Due Date',
    borrowedDate: 'Borrowed Date',
    returnedDate: 'Returned Date',
    status: 'Status',
    overdue: 'Overdue',
    active: 'Active Loan',
    returned: 'Returned',
    returnBook: 'Return Book',
    renewLoan: 'Renew Loan',
    daysRemaining: 'days remaining',
    fineAmount: 'Fine Amount',
    
    noBooksFound: 'No books matched your criteria.',
    searchEmptyHint: 'Try searching with different keywords or clear category filters.',
    success: 'Operation completed successfully!',
    error: 'An error occurred. Please try again.',
  },
  dv: {
    schoolPortal: 'މަގޫދޫ ސުކޫލް ޕޯޓަލް',
    schoolLibrary: 'މަގޫދޫ ސުކޫލް ލައިބްރަރީ',
    liveSync: 'ލައިވް ސިންކް',
    barcodeReader: 'ބާކޯޑް ރީޑަރ',
    directLink: 'ޑައިރެކްޓް ލިންކް',
    admin: 'އެޑްމިން',
    language: 'ބަސް / Language',
    activeProfile: 'މިހާރުގެ ޕްރޯފައިލް:',
    quickProfileSwitcher: 'އަވަހަށް ޕްރޯފައިލް ބަދަލުކުރައްވާ',
    registerParentAccount: '+ ބެލެނިވެރިއަކު ރަޖިސްޓަރީ ކުރައްވާ',
    directWebPortalLink: 'ޑައިރެކްޓް ވެބް ޕޯޓަލް ލިންކް',
    copyLink: 'ލިންކް ކޮޕީކުރައްވާ',
    copied: 'ކޮޕީވެއްޖެ!',
    closeWindow: 'ބަންދުކުރައްވާ',
    multiBrowserSupport: 'ހުރިހާ ބްރައުޒަރއެއްގައި ބޭނުންކުރެވޭނެ',
    multiBrowserDesc: 'މި ލިންކު ކޮންމެ ފޯނެއް، ټެބްލެޓެއް ނުވަތަ ކޮމްޕިއުޓަރެއްގެ ބްރައުޒަރއެއްގައި ހުޅުވައިގެން ލައިބްރަރީ ބޭނުންކުރެއްވޭނެއެވެ.',
    
    catalog: 'ފޮތްތަކުގެ ކެޓަލޮގް',
    aiLibrarian: 'އޭއައި ލައިބްރޭރިއަން',
    reference: 'ރެފަރެންސް ފޮތްތައް',
    borrowingHistory: 'ދޫކުރުމުގެ ތާރީޚް',
    scanCheckout: 'ބާކޯޑް ސްކޭނަރ',
    adminInventory: 'އެޑްމިން އަދި އިންވެންޓްރީ',
    memberDirectory: 'މެންބަރުންގެ ޑައިރެކްޓަރީ',
    reportsTrends: 'ރިޕޯޓް އަދި އެނަލިޓިކްސް',
    faqHelp: 'ސުވާލާއި އެހީ',
    lateReturns: 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތައް',
    parentPortal: 'ބެލެނިވެރިންގެ ޕޯޓަލް',
    
    searchPlaceholder: 'ފޮތުގެ ނަން، މުސަންނިފު، އައި.އެސް.ބީ.އެން ނުވަތަ ބާކޯޑުން ހޯއްދަވާ...',
    allCategories: 'ހުރިހާ ބައިތަކެއް',
    allTypes: 'ހުރިހާ ބާވަތެއް',
    circulating: 'ދޫކުރެވޭ ފޮތްތައް',
    referenceOnly: 'ރެފަރެންސް ފޮތްތައް އެކަނި',
    entriesPerPage: 'ޞަފްޙާއަކަށް ދައްކާނެ ޢަދަދު',
    showing: 'ދައްކަނީ',
    to: 'އިން',
    of: 'ގެ ތެރެއިން',
    entries: 'ފޮތް',
    
    titles: 'ފޮތުގެ ނަންތައް',
    physicalBooks: 'ފިޒިކަލް ފޮތްތައް',
    available: 'ލިބެންހުރި',
    checkedOut: 'ދޫކުރެވިފައި',
    reserveBook: 'ނަންނޯޓު ކުރައްވާ',
    quickBorrow: 'އަވަސް ދޫކުރުން',
    details: 'ތަފްޞީލު',
    viewMemberFile: 'މެންބަރުގެ ފައިލް',
    catalogSubtitle: '9,000 އަށްވުރެ ގިނަ ފޮތްތައް ހޯދައި، ބާކޯޑުން ސްކޭންކޮށް ނަންނޯޓު ކުރެއްވޭނެއެވެ.',
    
    adminRole: 'އެޑްމިން / ލައިބްރޭރިއަން',
    studentRole: 'ދަރިވަރު',
    parentRole: 'ބެލެނިވެރިއާ',
    staffRole: 'މުވައްޒަފު / ޓީޗަރު',
    
    addBook: 'އާ ފޮތެއް އިތުރުކުރައްވާ',
    addParent: 'ބެލެނިވެރިއަކު އިތުރުކުރައްވާ',
    addStaff: 'މުވައްޒަފަކު އިތުރުކުރައްވާ',
    importBulk: 'ބަލްކް އިމްޕޯޓް (CSV)',
    logout: 'ލޮގްއައުޓް',
    login: 'ލޮގިން ޕޯޓަލް',
    save: 'ރައްކާކުރައްވާ',
    cancel: 'ކެންސަލް',
    delete: 'ފޮހެލާ',
    confirm: 'ކަށަވަރުކުރައްވާ',
    printCard: 'ކާޑު ޕްރިންޓްކުރައްވާ',
    close: 'ބަންދުކުރައްވާ',
    exportCsv: 'CSV އަށް އެކްސްޕޯޓް',
    
    studentId: 'ދަރިވަރުގެ އައިޑީ',
    staffId: 'މުވައްޒަފުގެ އައިޑީ',
    department: 'ޑިޕާޓްމަންޓް / ފެކަލްޓީ',
    phone: 'ފޯނު',
    email: 'އީމެއިލް',
    linkedChildren: 'ގުޅުންހުރި ދަރިވަރުން',
    activeLoans: 'ނަގާފައިވާ ފޮތްތައް',
    membersCount: 'މެންބަރުން',
    allMembers: 'ހުރިހާ މެންބަރުން',
    students: 'ދަރިވަރުން',
    parents: 'ބެލެނިވެރިން',
    facultyStaff: 'މުވައްޒަފުން އަދި ޓީޗަރުން',
    searchMembersPlaceholder: 'ނަން، އީމެއިލް، ދަރިވަރުގެ އައިޑީ ނުވަތަ މުވައްޒަފުގެ އައިޑީން ހޯއްދަވާ...',
    
    dueDate: 'އަނބުރާ ދައްކަންޖެހޭ ތާރީޚް',
    borrowedDate: 'ނެގި ތާރީޚް',
    returnedDate: 'އަނބުރާ ދެއްކި ތާރީޚް',
    status: 'ޙާލަތު',
    overdue: 'މުއްދަތު ހަމަވެފައި',
    active: 'ނަގާފައިވާ ފޮތް',
    returned: 'އަނބުރާ ދައްކާފައި',
    returnBook: 'ފޮތް އަނބުރާ ޙަވާލުކުރައްވާ',
    renewLoan: 'މުއްދަތު އިތުރުކުރައްވާ',
    daysRemaining: 'ދުވަސް ބާކީ',
    fineAmount: 'ޖޫރިމަނާ ޢަދަދު',
    
    noBooksFound: 'ހޯއްދެވި ފޮތެއް ނުފެނުނެވެ.',
    searchEmptyHint: 'އެހެން ނަމަކުން ނުވަތަ ބާކޯޑަކުން އަލުން މަސައްކަތްކޮށްލައްވާ.',
    success: 'ކާމިޔާބުކަމާއެކު ނިމިއްޖެ!',
    error: 'މައްސަލައެއް ދިމާވެއްޖެ. އަލުން މަސައްކަތްކޮށްލައްވާ.',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en,
  isRtl: false,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved === 'dv' || saved === 'en') ? saved : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_lang', lang);
  };

  useEffect(() => {
    document.documentElement.dir = language === 'dv' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const value = {
    language,
    setLanguage,
    t: translations[language],
    isRtl: language === 'dv',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
