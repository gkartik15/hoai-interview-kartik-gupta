import PDFParser from 'pdf2json';

export async function getTextFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  console.log("JUST HERE");
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const data = pdfData as any;
      if (!data.Pages || !Array.isArray(data.Pages)) {
        return reject(new Error('Could not extract text: PDF structure not recognized.'));
      }
      const texts = data.Pages.flatMap((page: any) =>
        page.Texts.map((text: any) =>
          decodeURIComponent(text.R.map((r: any) => r.T).join(''))
        )
      );
      resolve(texts.join(' '));
    });
    pdfParser.parseBuffer(buffer);
  });
}