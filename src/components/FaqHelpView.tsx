import React, { useState } from 'react';
import { HelpCircle, ChevronDown, BookOpen, Clock, ShieldCheck, AlertCircle, Phone, Mail, MapPin } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export const FaqHelpView: React.FC = () => {
  const { t, language } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = language === 'dv' ? [
    {
      q: 'ދަރިވަރުން ލައިބްރަރީއިން ފޮތް ނަގާނީ ކިހިނެއް؟',
      a: 'ދަރިވަރުންނަށް އޮންލައިން ކެޓަލޮގުން ފޮތް ހޯދައި ނަންނޯޓު ކުރެއްވޭނެއެވެ. ނުވަތަ ދަރިވަރުގެ އައިޑީ ކާޑުގައިވާ ބާކޯޑް ދެއްކެވުމުން ލައިބްރޭރިއަން ފޮތް ދޫކޮށްދެއްވާނެއެވެ.'
    },
    {
      q: 'ފޮތެއް ނެގޭނެ އެންމެ ދިގު މުއްދަތަކީ ކޮބާ؟',
      a: 'އާންމުކޮށް ފޮތެއް ނެގޭނީ 14 ދުވަހުގެ މުއްދަތަށެވެ. އެހެން މެންބަރަކު ނަންނޯޓު ނުކުރާނަމަ، ޕޯޓަލް މެދުވެރިކޮށް 2 ފަހަރު މުއްދަތު އިތުރުކުރެވޭނެއެވެ.'
    },
    {
      q: 'ރެފަރެންސް ފޮތްތަކަކީ ކޮބާ؟',
      a: 'ރެފަރެންސް ފޮތްތަކަކީ (އެންސައިކްލޯޕީޑިއާ، ތާރީޚީ މުހިންމު ފޮތްތައް) ލައިބްރަރީން ބޭރަށް ދޫނުކުރެވޭ، ލައިބްރަރީގެ ތެރޭގައި އެކަނި ބޭނުންކުރެވޭ ފޮތްތަކެކެވެ.'
    },
    {
      q: 'ޖޫރިމަނާ ޢަދަދު ހިސާބުކުރެވޭނީ ކިހިނެއް؟',
      a: 'މުއްދަތު ހަމަވާ ދުވަހުގެ ފަހުން ކޮންމެ ދުވަހަކަށް 0.50 ޑޮލަރު ޖޫރިމަނާގެ ގޮތުގައި އިތުރުވާނެއެވެ. ބެލެނިވެރިންނަށް ޕޯޓަލްއިން ޖޫރިމަނާގެ ތަފްޞީލު ބައްލަވާލެއްވޭނެއެވެ.'
    },
    {
      q: 'ބެލެނިވެރިން ދަރިވަރުންގެ އެކައުންޓް ބަލަހައްޓާނީ ކިހިނެއް؟',
      a: 'ބެލެނިވެރިންގެ ޕޯޓަލްއަށް ލޮގިންވެވަޑައިގެން ދަރިވަރުން ނަގާފައިވާ ފޮތްތަކާއި، މުއްދަތު ހަމަވާ ތާރީޚް އަދި މުއްދަތު އިތުރުކުރުމުގެ ފުރުޞަތު ލިބިވަޑައިގަންނަވާނެއެވެ.'
    }
  ] : [
    {
      q: 'How do students borrow books from the library?',
      a: 'Students can search the online Book Catalog and click "Reserve Online" or present their Student ID barcode to the librarian at the circulation desk for quick checkout.'
    },
    {
      q: 'What is the maximum loan period for circulating books?',
      a: 'The default loan period is 14 days. Students can renew their borrowed books up to 2 times online through the Parent / Member portal unless reserved by another borrower.'
    },
    {
      q: 'What are "Reference Only" books?',
      a: 'Reference books (encyclopedias, rare historical texts, research compendiums) are non-circulating and marked with an orange "Reference Only" badge. They must be consulted inside the library reading rooms.'
    },
    {
      q: 'How are late fees calculated and paid?',
      a: 'Late fees accrue at $0.50 per overdue day after the grace period. Parents and students can view accrued fees in their account portal and pay them at the library desk or clear them during return.'
    },
    {
      q: 'How do parents manage their children\'s library accounts?',
      a: 'Parents can log in to the Parent Portal to view active borrowings, due dates, renewal options, and add multiple children under a single account.'
    }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5 text-blue-600" /> {t.faqHelp}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {t.faqHelp}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          {language === 'dv'
            ? 'މަގޫދޫ ސުކޫލް ލައިބްރަރީގެ އުޞޫލުތަކާއި، ފޮތް ނެގުމާއި އަނބުރާ ޙަވާލުކުރުމާ ގުޅޭ މަޢުލޫމާތު.'
            : 'Guides, loan rules, reference policies, and assistance for Magoodhoo School Library.'}
        </p>
      </div>

      {/* Accordion FAQ list */}
      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 text-left font-extrabold text-slate-900 text-sm sm:text-base flex items-center justify-between gap-4 hover:bg-slate-50 transition"
              >
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center flex-shrink-0">
                    Q{idx + 1}
                  </span>
                  {faq.q}
                </span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-slate-100 bg-slate-50/50">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Library Contact Card */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <h3 className="font-black text-lg sm:text-xl tracking-tight text-white">Need Additional Assistance?</h3>
        <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl">
          Visit the Library Desk during school hours (7:30 AM - 4:30 PM, Monday through Friday) or reach out directly to the librarian staff.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800 text-xs font-semibold text-slate-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>123 Library St, Booksville</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>+01 234 567 88</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>info@libraryms.example</span>
          </div>
        </div>
      </div>
    </div>
  );
};
