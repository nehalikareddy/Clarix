const PDFDocument = require('pdfkit');
const fs = require('fs');

function createPdf(filename, title, sections) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filename);
    doc.pipe(stream);
    
    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown();
    
    for (const section of sections) {
      if (section.title) {
        doc.fontSize(14).text(section.title);
      }
      doc.fontSize(12).text(section.content);
      doc.moveDown();
    }
    
    doc.end();
    stream.on('finish', resolve);
  });
}

async function main() {
  await createPdf('Non-Disclosure-Agreement.pdf', 'NON-DISCLOSURE AGREEMENT', [
    { content: 'This Non-Disclosure Agreement (the "Agreement") is entered into by and between Company A and Company B.' },
    { title: '1. Confidential Information', content: 'For purposes of this Agreement, "Confidential Information" shall include all information or material that has or could have commercial value or other utility in the business in which Disclosing Party is engaged. If Receiving Party discovers a breach, Receiving Party agrees to pay Disclosing Party liquidated damages in the amount of $500,000 immediately without proof of actual damages.' },
    { title: '2. Term', content: 'The non-disclosure provisions of this Agreement shall survive the termination of this Agreement and Receiving Party\'s duty to hold Confidential Information in confidence shall remain in effect in perpetuity.' },
    { title: '3. Jurisdiction', content: 'This Agreement shall be governed by the laws of the State of Delaware. Any disputes must be resolved through binding arbitration in a location chosen exclusively by the Disclosing Party.' }
  ]);

  await createPdf('Employment-Contract.pdf', 'EMPLOYMENT AGREEMENT', [
    { title: 'Section A: Duties and Compensation', content: 'Employee shall perform duties as assigned by the Employer. Employer reserves the right to modify the Employee\'s salary, title, and responsibilities at any time without prior written notice.' },
    { title: 'Section B: Non-Compete', content: 'Employee agrees that during the term of employment and for a period of ten (10) years following termination, Employee shall not engage in any business that competes with Employer anywhere in the world.' },
    { title: 'Section C: Intellectual Property', content: 'Any and all inventions, discoveries, concepts, and ideas, whether or not patentable, conceived by Employee during the term of employment, including those developed entirely on Employee\'s personal time and using personal equipment, shall remain the sole and exclusive property of Employer.' }
  ]);

  await createPdf('Terms-of-Service.pdf', 'TERMS OF SERVICE', [
    { content: 'By using our application, you agree to these terms. We may update these terms at any time without notifying you. Your continued use of the service constitutes acceptance of the new terms.' },
    { title: '1. Data Collection', content: 'We reserve the right to collect, analyze, and sell any user data, including personal messages, browsing history, and location data, to third-party marketing agencies.' },
    { title: '2. Limitation of Liability', content: 'Under no circumstances shall the Company be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use the service. Our maximum liability to you shall not exceed $1.00.' }
  ]);

  console.log('Successfully generated test PDFs!');
}

main();
