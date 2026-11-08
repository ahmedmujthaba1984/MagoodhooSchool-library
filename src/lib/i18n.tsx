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
  installApp: string;
  offlineMode: string;
  
  // Navigation & Tabs
  navigationDesk: string;
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
  quickCheckout: string;
  checkinItem: string;
  myLoans: string;
  activeLoansCount: string;
  overdueCountLabel: string;
  goodStanding: string;
  noActiveLoans: string;
  noOverdueLoans: string;

  // Search & Multi-Facet Filters
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
  itemsFiltered: string;
  filterByStatus: string;
  filterByGrade: string;
  filterByDdc: string;
  allGrades: string;
  allStatuses: string;
  allLanguages: string;
  filterSearchTable: string;
  resetAllFilters: string;
  
  // Catalog Stats & Headers
  titles: string;
  physicalBooks: string;
  available: string;
  checkedOut: string;
  reserveBook: string;
  reservedOnline: string;
  quickBorrow: string;
  details: string;
  viewMemberFile: string;
  catalogSubtitle: string;
  viewDetails: string;
  editBook: string;
  deleteBook: string;
  printBarcode: string;
  shelfLocation: string;
  byAuthor: string;
  isbnLabel: string;
  copiesLabel: string;
  barcodeLabel: string;
  ddcCallNo: string;
  
  // Roles
  adminRole: string;
  studentRole: string;
  parentRole: string;
  staffRole: string;
  switchRoleLogin: string;
  
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
  back: string;
  next: string;
  previous: string;
  
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
  
  // Borrowing / Loans & Statuses
  dueDate: string;
  borrowedDate: string;
  returnedDate: string;
  status: string;
  statusActive: string;
  statusOverdue: string;
  statusReturned: string;
  statusAvailable: string;
  statusCheckedOut: string;
  statusReferenceOnly: string;
  statusReserved: string;
  statusPending: string;
  statusCancelled: string;
  overdue: string;
  active: string;
  returned: string;
  returnBook: string;
  renewLoan: string;
  daysRemaining: string;
  fineAmount: string;
  renewalsUsed: string;
  extendLoan: string;
  maxRenewed: string;
  cancelReservation: string;
  
  // Circulation Desk & Return Forms
  scanOrEnterBarcode: string;
  step1SelectBook: string;
  step2SelectStudent: string;
  step3LoanDuration: string;
  borrowDurationDays: string;
  calculatedDueDate: string;
  schoolWeekNote: string;
  confirmCheckout: string;
  processReturn: string;
  returnReceipt: string;
  returnedBy: string;
  lateFeeAssessed: string;
  noFine: string;
  clearReturn: string;
  quickSelectBook: string;
  quickSelectStudent: string;
  availableStock: string;
  
  // Fine Warnings & Policies
  fineWarningTitle: string;
  fineWarningDesc: string;
  fineWarningAction: string;
  fineRate: string;
  unpaidFines: string;
  waiveFine: string;
  payFine: string;
  lateFeeAccumulating: string;
  
  // Categories Dynamic Mapping
  catFiction: string;
  catIslamic: string;
  catDhivehi: string;
  catScience: string;
  catHistory: string;
  catChildren: string;
  catReference: string;
  catArts: string;
  catTech: string;
  catFantasy: string;
  catGeneral: string;

  // Messages & Alerts
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
    installApp: 'Install App',
    offlineMode: 'Offline Mode',
    
    navigationDesk: 'Navigation Desk',
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
    quickCheckout: 'Quick Checkout',
    checkinItem: 'Check-in Item',
    myLoans: 'My Active Loans & History',
    activeLoansCount: 'Active Circulation',
    overdueCountLabel: 'Overdue Items',
    goodStanding: 'All Loans in Good Standing',
    noActiveLoans: 'No Active Loans Right Now',
    noOverdueLoans: 'No Overdue Books! Great job.',
    
    searchPlaceholder: 'Search titles, authors, ISBN, barcode, publisher or call number...',
    allCategories: 'All Categories',
    allTypes: 'All Types',
    circulating: 'Circulating Books',
    referenceOnly: 'Reference Only',
    entriesPerPage: 'entries per page',
    showing: 'Showing',
    to: 'to',
    of: 'of',
    entries: 'books',
    itemsFiltered: 'items filtered',
    filterByStatus: 'Filter by Status',
    filterByGrade: 'Grade Suitability',
    filterByDdc: 'DDC Category',
    allGrades: 'All Grades',
    allStatuses: 'All Statuses',
    allLanguages: 'All Languages',
    filterSearchTable: 'Filter table...',
    resetAllFilters: 'Reset All Filters',
    
    titles: 'Titles',
    physicalBooks: 'Physical Books',
    available: 'Available',
    checkedOut: 'Checked Out',
    reserveBook: 'Reserve Book',
    reservedOnline: 'Reserved Online',
    quickBorrow: 'Quick Borrow',
    details: 'Details',
    viewMemberFile: 'View Member File',
    catalogSubtitle: 'High-volume catalog portal supporting physical volumes and online student reservations.',
    viewDetails: 'View Details',
    editBook: 'Edit Record',
    deleteBook: 'Delete Record',
    printBarcode: 'Print Barcode Label',
    shelfLocation: 'Shelf Location',
    byAuthor: 'by',
    isbnLabel: 'ISBN',
    copiesLabel: 'Copies',
    barcodeLabel: 'Barcode',
    ddcCallNo: 'Call Number',
    
    adminRole: 'Admin / Librarian',
    studentRole: 'Student Member',
    parentRole: 'Parent Account',
    staffRole: 'Faculty & Staff',
    switchRoleLogin: 'Switch Role / Login',
    
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
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    
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
    statusActive: 'Active Loan',
    statusOverdue: 'Overdue',
    statusReturned: 'Returned',
    statusAvailable: 'Available',
    statusCheckedOut: 'Checked Out',
    statusReferenceOnly: 'Reference Only',
    statusReserved: 'Reserved',
    statusPending: 'Pending',
    statusCancelled: 'Cancelled',
    overdue: 'Overdue',
    active: 'Active Loan',
    returned: 'Returned',
    returnBook: 'Return Book',
    renewLoan: 'Renew Loan',
    daysRemaining: 'days remaining',
    fineAmount: 'Fine Amount',
    renewalsUsed: 'Renewals used',
    extendLoan: 'Extend Loan (+14 Days)',
    maxRenewed: 'Max Renewed',
    cancelReservation: 'Cancel Reservation',
    
    scanOrEnterBarcode: 'Scan or Enter Barcode / ISBN Number:',
    step1SelectBook: 'Step 1: Scan or Select Book Barcode',
    step2SelectStudent: 'Step 2: Scan or Select Student Member',
    step3LoanDuration: 'Step 3: Loan Duration & Due Date',
    borrowDurationDays: 'Days:',
    calculatedDueDate: 'Calculated Due Date:',
    schoolWeekNote: '(Sun–Thu School Working Week)',
    confirmCheckout: 'Process Book Checkout',
    processReturn: 'Submit Book Return',
    returnReceipt: 'Book Return Receipt',
    returnedBy: 'Returned By',
    lateFeeAssessed: 'Late Fee Assessed:',
    noFine: 'No Late Fee (Returned on Time)',
    clearReturn: 'Done & Clear Receipt',
    quickSelectBook: 'Quick Select From List...',
    quickSelectStudent: 'Select Student...',
    availableStock: 'Available Stock:',
    
    fineWarningTitle: 'Action Required: Overdue Items Detected!',
    fineWarningDesc: 'Total late fine accumulated:',
    fineWarningAction: 'Please return overdue books to the circulation desk or clear fees.',
    fineRate: 'MVR 0.50 per working day',
    unpaidFines: 'Unpaid Fines',
    waiveFine: 'Waive Fine',
    payFine: 'Pay Fine',
    lateFeeAccumulating: 'Late fee accumulating:',
    
    catFiction: 'Fiction & Literature',
    catIslamic: 'Islamic Studies & Quran',
    catDhivehi: 'Dhivehi Literature & Raadhavalhi',
    catScience: 'Science & Nature',
    catHistory: 'History & Social Studies',
    catChildren: 'Children Literature',
    catReference: 'Reference & Dictionaries',
    catArts: 'Arts, Culture & Sports',
    catTech: 'Computer Science & STEM',
    catFantasy: 'Fantasy & Adventure',
    catGeneral: 'General Collection',

    noBooksFound: 'No books matched your criteria.',
    searchEmptyHint: 'Try searching with different keywords, ISBN, or clear category filters.',
    success: 'Operation completed successfully!',
    error: 'An error occurred. Please try again.',
  },
  dv: {
    schoolPortal: 'މަގޫދޫ ސްކޫލް ޕޯޓަލް',
    schoolLibrary: 'މަގޫދޫ ސްކޫލް ލައިބްރަރީ',
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
    multiBrowserDesc: 'މި ލިންކު ކޮންމެ ފޯނެއް، ޓެބްލެޓެއް ނުވަތަ ކޮމްޕިއުޓަރެއްގެ ބްރައުޒަރއެއްގައި ހުޅުވައިގެން ލައިބްރަރީ ބޭނުންކުރެއްވޭނެއެވެ.',
    installApp: 'އެޕް އިންސްޓޯލް ކުރޭ',
    offlineMode: 'އޮފްލައިން މޯޑު',
    
    navigationDesk: 'މެނޫ / ނެވިގޭޝަން',
    catalog: 'ފޮތްތަކުގެ ކެޓަލޮގް',
    aiLibrarian: 'ސްމާޓް ލައިބްރޭރިއަން',
    reference: 'ރެފަރެންސް ފޮތްތައް',
    borrowingHistory: 'ދޫކުރުމުގެ ތާރީޚް',
    scanCheckout: 'ބާކޯޑް ސްކޭނަރ އަދި ދޫކުރުން',
    adminInventory: 'އެޑްމިން އަދި އިންވެންޓްރީ',
    memberDirectory: 'މެންބަރުންގެ ޑައިރެކްޓަރީ',
    reportsTrends: 'ރިޕޯޓް އަދި އެނަލިޓިކްސް',
    faqHelp: 'ސުވާލާއި އެހީ',
    lateReturns: 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތައް',
    parentPortal: 'ބެލެނިވެރިންގެ ޕޯޓަލް',
    quickCheckout: 'ފޮތް ދޫކުރުން',
    checkinItem: 'އަނބުރާ ޙަވާލުކުރުން',
    myLoans: 'އަޅުގަނޑު ނަގާފައިވާ ފޮތްތައް',
    activeLoansCount: 'ނަގާފައިވާ ފޮތްތައް',
    overdueCountLabel: 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތައް',
    goodStanding: 'ހުރިހާ ފޮތެއްގެ މުއްދަތު ހަމަނުވޭ',
    noActiveLoans: 'މިވަގުތު ނަގާފައިވާ ފޮތެއް ނެތް',
    noOverdueLoans: 'މުއްދަތު ހަމަވެފައިވާ ފޮތެއް ނެތް! ސާބަސް.',
    
    searchPlaceholder: 'ފޮތުގެ ނަން، މުސަންނިފު، އައި.އެސް.ބީ.އެން، ބާކޯޑު ނުވަތަ ރެކު ނަންބަރުން ހޯއްދަވާ...',
    allCategories: 'ހުރިހާ ބައިތަކެއް',
    allTypes: 'ހުރިހާ ބާވަތެއް',
    circulating: 'ދޫކުރެވޭ ފޮތްތައް',
    referenceOnly: 'ރެފަރެންސް ފޮތްތައް އެކަނި',
    entriesPerPage: 'ޞަފްޙާއަކަށް ދައްކާނެ ޢަދަދު',
    showing: 'ދައްކަނީ',
    to: 'އިން',
    of: 'ގެ ތެރެއިން',
    entries: 'ފޮތް',
    itemsFiltered: 'ފޮތް ފެނިފައިވޭ',
    filterByStatus: 'ޙާލަތުން ފުރާނާލައްވާ',
    filterByGrade: 'ގްރޭޑް / އުމުރުފުރާ',
    filterByDdc: 'ޑީ.ޑީ.ސީ ކެޓަގަރީ',
    allGrades: 'ހުރިހާ ގްރޭޑެއް',
    allStatuses: 'ހުރިހާ ޙާލަތެއް',
    allLanguages: 'ހުރިހާ ބަހެއް',
    filterSearchTable: 'ފޮތުގެ ނަމުން...',
    resetAllFilters: 'ހުރިހާ ފިލްޓަރެއް ފޮހެލާ',
    
    titles: 'ފޮތުގެ ނަންތައް',
    physicalBooks: 'ފިޒިކަލް ފޮތްތައް',
    available: 'ލިބެންހުރި',
    checkedOut: 'ދޫކުރެވިފައި',
    reserveBook: 'ނަންނޯޓު ކުރައްވާ',
    reservedOnline: 'ނަންނޯޓު ކުރެވިފައި',
    quickBorrow: 'އަވަސް ދޫކުރުން',
    details: 'ތަފްޞީލު',
    viewMemberFile: 'މެންބަރުގެ ފައިލް',
    catalogSubtitle: 'މަގޫދޫ ސްކޫލް ލައިބްރަރީގެ ފޮތްތައް ހޯދައި، ބާކޯޑުން ސްކޭންކޮށް ނަންނޯޓު ކުރެއްވޭނެއެވެ.',
    viewDetails: 'ތަފްޞީލު ބައްލަވާ',
    editBook: 'ރެކޯޑު ބަދަލުކުރައްވާ',
    deleteBook: 'ރެކޯޑު ފޮހެލައްވާ',
    printBarcode: 'ބާކޯޑު ލޭބަލް ޕްރިންޓްކުރައްވާ',
    shelfLocation: 'ބަހައްޓާފައިވާ ރެކު',
    byAuthor: 'މުސަންނިފު:',
    isbnLabel: 'އައި.އެސް.ބީ.އެން',
    copiesLabel: 'ކޮޕީ',
    barcodeLabel: 'ބާކޯޑު',
    ddcCallNo: 'ކޯލް ނަންބަރު',
    
    adminRole: 'އެޑްމިން / ލައިބްރޭރިއަން',
    studentRole: 'ދަރިވަރު',
    parentRole: 'ބެލެނިވެރިއާ',
    staffRole: 'މުވައްޒަފު / ޓީޗަރު',
    switchRoleLogin: 'ރޯލް ބަދަލުކުރައްވާ / ލޮގިން',
    
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
    back: 'ފަހަތަށް',
    next: 'ކުރިއަށް',
    previous: 'ފަހަތަށް',
    
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
    statusActive: 'ނަގާފައިވާ ފޮތް',
    statusOverdue: 'މުއްދަތު ހަމަވެފައި',
    statusReturned: 'އަނބުރާ ދައްކާފައި',
    statusAvailable: 'ލިބެންހުރި',
    statusCheckedOut: 'ދޫކުރެވިފައި',
    statusReferenceOnly: 'ރެފަރެންސް އެކަނި',
    statusReserved: 'ނަންނޯޓު ކުރެވިފައި',
    statusPending: 'އިންތިޒާރުގައި',
    statusCancelled: 'ކެންސަލްކޮށްފައި',
    overdue: 'މުއްދަތު ހަމަވެފައި',
    active: 'ނަގާފައިވާ ފޮތް',
    returned: 'އަނބުރާ ދައްކާފައި',
    returnBook: 'ފޮތް އަނބުރާ ޙަވާލުކުރައްވާ',
    renewLoan: 'މުއްދަތު އިތުރުކުރައްވާ',
    daysRemaining: 'ދުވަސް ބާކީ',
    fineAmount: 'ޖޫރިމަނާ ޢަދަދު',
    renewalsUsed: 'އިތުރުކުރެވުނު ފަހަރު',
    extendLoan: 'މުއްދަތު އިތުރުކުރައްވާ (+14 ދުވަސް)',
    maxRenewed: 'އިތުރުކުރެވޭނެ އެންމެ ގިނަ ފަހަރު ހަމަވެއްޖެ',
    cancelReservation: 'ރިޒަވޭޝަން ކެންސަލްކުރައްވާ',
    
    scanOrEnterBarcode: 'ބާކޯޑު ނުވަތަ އައި.އެސް.ބީ.އެން ނަންބަރު ޖައްސަވާ:',
    step1SelectBook: 'ފިޔަވަޅު 1: ފޮތުގެ ބާކޯޑު ސްކޭން ނުވަތަ ޚިޔާރުކުރައްވާ',
    step2SelectStudent: 'ފިޔަވަޅު 2: ދަރިވަރު ސްކޭން ނުވަތަ ޚިޔާރުކުރައްވާ',
    step3LoanDuration: 'ފިޔަވަޅު 3: ފޮތް ދޫކުރާ މުއްދަތާއި އަނބުރާ ޙަވާލުކުރަންޖެހޭ ތާރީޚް',
    borrowDurationDays: 'ދުވަސް:',
    calculatedDueDate: 'އަނބުރާ ޙަވާލުކުރަންޖެހޭ ތާރީޚް:',
    schoolWeekNote: '(އާދީއްތަ-ބުރާސްފަތި ސްކޫލް ކަލަންޑަރ)',
    confirmCheckout: 'ފޮތް ދޫކުރުން ކަށަވަރުކުރައްވާ',
    processReturn: 'ފޮތް ބަލައިގަތުން ފުރިހަމަކުރައްވާ',
    returnReceipt: 'ފޮތް ބަލައިގަތްކަމުގެ ރަސީދު',
    returnedBy: 'ޙަވާލުކުރީ:',
    lateFeeAssessed: 'ޖޫރިމަނާ ފީ:',
    noFine: 'ޖޫރިމަނާއެއް ނެތް (ވަގުތަށް ޙަވާލުކުރެވިފައި)',
    clearReturn: 'ނިމުނީ / ރަސީދު ކްލިއަރކުރައްވާ',
    quickSelectBook: 'ފޮތްތަކުގެ ލިސްޓުން އަވަހަށް ނަންގަވާ...',
    quickSelectStudent: 'ދަރިވަރަކު ޚިޔާރުކުރައްވާ...',
    availableStock: 'ލިބެންހުރި ސްޓޮކް:',
    
    fineWarningTitle: 'ސަމާލުކަމަށް: މުއްދަތު ހަމަވެފައިވާ ފޮތްތަކެއް އެބަހުރި!',
    fineWarningDesc: 'އަރާފައިވާ ޖުމްލަ ޖޫރިމަނާ:',
    fineWarningAction: 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތައް އަވަހަށް ޙަވާލުކުރައްވާ ނުވަތަ ލައިބްރޭރިއަނާ ގުޅުއްވާ.',
    fineRate: 'ދުވަހަކަށް 0.50 ރުފިޔާ',
    unpaidFines: 'ނުދައްކާ ހުރި ޖޫރިމަނާ',
    waiveFine: 'ޖޫރިމަނާ މަޢާފްކުރައްވާ',
    payFine: 'ޖޫރިމަނާ ދައްކަވާ',
    lateFeeAccumulating: 'އަރަމުންދާ ޖޫރިމަނާ:',
    
    catFiction: 'ވާހަކަ އާއި އަދަބިއްޔާތު',
    catIslamic: 'އިސްލާމީ ތަޢުލީމާއި ޤުރުއާން',
    catDhivehi: 'ދިވެހި އަދަބިއްޔާތާއި ރާދަވަޅި',
    catScience: 'ސައިންސާއި ޤުދުރަތީ ޢިލްމު',
    catHistory: 'ތާރީޚާއި އިޖުތިމާޢީ ދިރާސާ',
    catChildren: 'ކުޑަކުދިންގެ އަދަބިއްޔާތު',
    catReference: 'ރެފަރެންސާއި ރަދީފު / އެޓްލަސް',
    catArts: 'ހުނަރާއި ކުޅިވަރު އަދި ސަގާފަތް',
    catTech: 'ކޮމްޕިއުޓަރ ޓެކްނޮލޮޖީ އަދި STEM',
    catFantasy: 'ފެންޓަސީ އަދި އެޑްވެންޗަރ',
    catGeneral: 'އާންމު ފޮތްތައް',

    noBooksFound: 'ހޯއްދެވި ފޮތެއް ނުފެނުނެވެ.',
    searchEmptyHint: 'އެހެން ނަމަކުން، އައި.އެސް.ބީ.އެން ނުވަތަ ބާކޯޑަކުން އަލުން މަސައްކަތްކޮށްލައްވާ.',
    success: 'ކާމިޔާބުކަމާއެކު ނިމިއްޖެ!',
    error: 'މައްސަލައެއް ދިމާވެއްޖެ. އަލުން މަސައްކަތްކޮށްލައްވާ.',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isRtl: boolean;
  localizeCategory: (cat: string) => string;
  localizeStatus: (status: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en,
  isRtl: false,
  localizeCategory: (cat) => cat,
  localizeStatus: (status) => status,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('app_lang') : null;
    return (saved === 'dv' || saved === 'en') ? saved : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_lang', lang);
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = language === 'dv' ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
      if (language === 'dv') {
        document.documentElement.classList.add('rtl-mode');
      } else {
        document.documentElement.classList.remove('rtl-mode');
      }
    }
  }, [language]);

  const localizeCategory = (cat: string): string => {
    if (!cat) return '';
    if (language !== 'dv') return cat;
    const clean = cat.trim().toLowerCase();
    if (clean.includes('islamic') || clean.includes('quran')) return translations.dv.catIslamic;
    if (clean.includes('dhivehi') || clean.includes('raadha')) return translations.dv.catDhivehi;
    if (clean.includes('science & tech') || clean.includes('stem') || clean.includes('computer') || clean.includes('tech')) return translations.dv.catTech;
    if (clean.includes('science') || clean.includes('nature') || clean.includes('biology')) return translations.dv.catScience;
    if (clean.includes('history') || clean.includes('social') || clean.includes('geography')) return translations.dv.catHistory;
    if (clean.includes('child')) return translations.dv.catChildren;
    if (clean.includes('reference') || clean.includes('atlas') || clean.includes('dictionar')) return translations.dv.catReference;
    if (clean.includes('fantasy') || clean.includes('adventure')) return translations.dv.catFantasy;
    if (clean.includes('art') || clean.includes('music') || clean.includes('sport')) return translations.dv.catArts;
    if (clean.includes('fiction') || clean.includes('literature') || clean.includes('novel')) return translations.dv.catFiction;
    return cat;
  };

  const localizeStatus = (status: string): string => {
    if (!status) return '';
    if (language !== 'dv') return status;
    const s = status.toLowerCase();
    if (s === 'available') return translations.dv.statusAvailable;
    if (s === 'checked out' || s === 'checked-out' || s === 'active') return translations.dv.statusActive;
    if (s === 'overdue') return translations.dv.statusOverdue;
    if (s === 'returned') return translations.dv.statusReturned;
    if (s === 'reference' || s === 'reference only') return translations.dv.statusReferenceOnly;
    if (s === 'reserved') return translations.dv.statusReserved;
    if (s === 'pending') return translations.dv.statusPending;
    if (s === 'cancelled') return translations.dv.statusCancelled;
    return status;
  };

  const value = {
    language,
    setLanguage,
    t: translations[language],
    isRtl: language === 'dv',
    localizeCategory,
    localizeStatus,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
