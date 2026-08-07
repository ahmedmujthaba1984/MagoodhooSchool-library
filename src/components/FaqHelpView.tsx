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
      a: 'ދަރިވަރުންނަށް ފޮތެއް ނެގޭނީ 14 ދުވަހުގެ މުއްދަތަށެވެ. މުދައްރިސުންނަށް 30 ދުވަހުގެ މުއްދަތު ލިބިވަޑައިގަންނަވާނެއެވެ. އެހެން މެންބަރަކު ނަންނޯޓު ނުކުރާނަމަ، 2 ފަހަރު މުއްދަތު އިތުރުކުރެވޭނެއެވެ.'
    },
    {
      q: 'ޖޫރިމަނާއާއި ގްރޭސް ޕީރިއަޑް ހިނގާނީ ކިހިނެއް؟',
      a: 'މުއްދަތު ހަމަވުމަށްފަހު 2 ދުވަހުގެ ގްރޭސް ޕީރިއަޑެއް (ލުއި މުއްދަތެއް) ލިބޭނެއެވެ. އެއަށްފަހު ކޮންމެ ލަސްވާ ދުވަހަކަށް 0.50 ޑޮލަރުގެ ޖޫރިމަނާއެއް އިތުރުވާނެއެވެ.'
    },
    {
      q: 'އެކަކަށް އެއްފަހަރާ ނެގޭނީ ކިތައް ފޮތް؟',
      a: 'ދަރިވަރަކަށް އެއްފަހަރާ ނެގޭނީ އެންމެ ގިނަވެގެން 3 ފޮތެވެ. މުދައްރިސުންނަށް 7 ފޮތް ނެގުމުގެ އިޚްތިޔާރު ލިބިވަޑައިގަންނަވާނެއެވެ. އަދި އެއްފަހަރާ 2 ފޮތް ނަންނޯޓު (ރިޒާވް) ކުރެއްވޭނެއެވެ.'
    },
    {
      q: 'ފޮތް ގެއްލިއްޖެނަމަ ނުވަތަ ހަލާކުވެއްޖެނަމަ ހަދާނީ ކިހިނެއް؟',
      a: 'ފޮތް ގެއްލިއްޖެނަމަ 15.00 ޑޮލަރުގެ އެޑްމިނިސްޓްރޭޓިވް ފީއަކާއެކު ފޮތުގެ އަގު ދައްކަވަންޖެހޭނެއެވެ. ނުވަތަ އެއްގޮތް އާ ފޮތެއް ލައިބްރަރީއަށް ޙަވާލުކުރެއްވިދާނެއެވެ.'
    },
    {
      q: 'ރެފަރެންސް ފޮތްތަކުގެ އުޞޫލަކީ ކޮބާ؟',
      a: 'ރެފަރެންސް ފޮތްތަކަކީ (އެންސައިކްލޯޕީޑިއާ، ރެފަރެންސް މެނުއަލް) ލައިބްރަރީން ބޭރަށް ދޫނުކުރެވޭ ފޮތްތަކެކެވެ. ނަމަވެސް މުދައްރިސުންނަށް ރޭގަނޑަށް ދޫކުރުމުގެ ޚާއްޞަ ހުއްދަ ލިބިވަޑައިގަންނަވައެވެ.'
    }
  ] : [
    {
      q: 'How do students borrow books from the library?',
      a: 'Students can search the online Book Catalog and click "Reserve Online" or present their Student ID barcode to the librarian at the circulation desk for quick checkout.'
    },
    {
      q: 'What is the maximum loan period for circulating books?',
      a: 'Students receive a standard 14-day loan period. Teachers and staff receive 30 days. Borrowers can renew loans up to 2 times online if no active holds exist.'
    },
    {
      q: 'How do grace periods and late fees work?',
      a: 'A 2-day grace period is granted after the due date before fines begin. After the grace period, late fees accrue at $0.50 per day overdue until the item is returned.'
    },
    {
      q: 'What are the borrowing quotas per member?',
      a: 'Students can check out up to 3 books simultaneously. Staff/Faculty can check out up to 7 books. Each member can place up to 2 active online reservations.'
    },
    {
      q: 'What happens if a book is lost or damaged?',
      a: 'Lost or severely damaged books incur a flat $15.00 administrative fee plus the replacement cost of the book, or replacement with an identical new copy approved by the librarian.'
    },
    {
      q: 'What are the rules for "Reference Only" books?',
      a: 'Reference books are non-circulating items designated for library reading room study only. However, faculty members may request overnight loan permissions at librarian discretion.'
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
          {language === 'dv' ? 'ލައިބްރަރީ ގަވާއިދުތަކާއި އެހީ' : 'Library Circulation Rules & Help Desk'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          {language === 'dv'
            ? 'މަގޫދޫ ސްކޫލް ލައިބްރަރީގެ އުޞޫލުތަކާއި، ފޮތް ނެގުމާއި އަނބުރާ ޙަވާލުކުރުމުގެ ރަސްމީ ގަވާއިދުތައް.'
            : 'Official loan policies, checkout quotas, grace periods, fees, and assistance for Magoodhoo School Library.'}
        </p>
      </div>

      {/* Official Circulation Rules Quick Reference Cards */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 border border-indigo-900/50">
        <div className="flex items-center justify-between border-b border-indigo-800/60 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h2 className="font-extrabold text-base sm:text-lg text-white">
              {language === 'dv' ? 'ރަސްމީ ސާކިއުލޭޝަން އުޞޫލުތަކުގެ ޚުލާޞާ' : 'Official Circulation Rules At A Glance'}
            </h2>
          </div>
          <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
            {language === 'dv' ? 'ސިސްޓަމް އުޞޫލު' : 'Active Policy'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-1">
            <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              {language === 'dv' ? 'ފޮތް ނެގޭ މުއްދަތު' : 'Loan Durations'}
            </div>
            <p className="text-slate-300 font-medium text-[11px] leading-relaxed">
              • {language === 'dv' ? 'ދަރިވަރުން:' : 'Students:'} <span className="font-bold text-white">14 {language === 'dv' ? 'ދުވަސް' : 'Days'}</span><br />
              • {language === 'dv' ? 'މުވައްޒަފުން:' : 'Faculty/Staff:'} <span className="font-bold text-white">30 {language === 'dv' ? 'ދުވަސް' : 'Days'}</span><br />
              • {language === 'dv' ? 'އިތުރުކުރުން:' : 'Max Renewals:'} <span className="font-bold text-white">2 {language === 'dv' ? 'ފަހަރު' : 'Times'}</span>
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-1">
            <div className="font-extrabold text-emerald-300 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              {language === 'dv' ? 'ފޮތް ނެގުމުގެ ކޯޓާ' : 'Checkout Quotas'}
            </div>
            <p className="text-slate-300 font-medium text-[11px] leading-relaxed">
              • {language === 'dv' ? 'ދަރިވަރުން:' : 'Students:'} <span className="font-bold text-white">3 {language === 'dv' ? 'ފޮތް' : 'Books max'}</span><br />
              • {language === 'dv' ? 'މުވައްޒަފުން:' : 'Faculty/Staff:'} <span className="font-bold text-white">7 {language === 'dv' ? 'ފޮތް' : 'Books max'}</span><br />
              • {language === 'dv' ? 'ނަންނޯޓު:' : 'Reservations:'} <span className="font-bold text-white">2 {language === 'dv' ? 'ފޮތް' : 'Holds max'}</span>
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-1">
            <div className="font-extrabold text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              {language === 'dv' ? 'ޖޫރިމަނާއާއި ފީ' : 'Grace Period & Fees'}
            </div>
            <p className="text-slate-300 font-medium text-[11px] leading-relaxed">
              • {language === 'dv' ? 'ގްރޭސް ޕީރިއަޑް:' : 'Grace Period:'} <span className="font-bold text-white">2 {language === 'dv' ? 'ދުވަސް' : 'Days free'}</span><br />
              • {language === 'dv' ? 'ދުވަހު ޖޫރިމަނާ:' : 'Late Fee:'} <span className="font-bold text-white">$0.50 / {language === 'dv' ? 'ދުވަސް' : 'day'}</span><br />
              • {language === 'dv' ? 'ގެއްލޭ ފޮތުގެ ފީ:' : 'Lost Item Fee:'} <span className="font-bold text-white">$15.00 + {language === 'dv' ? 'ފޮތުގެ އަގު' : 'Cost'}</span>
            </p>
          </div>
        </div>
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
