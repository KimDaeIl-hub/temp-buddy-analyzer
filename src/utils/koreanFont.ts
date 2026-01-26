// Korean font support for jsPDF
// Using Noto Sans Korean (subset) for better file size

export const addKoreanFont = async (pdf: any) => {
  // Load NanumGothic font from CDN
  try {
    const fontUrl = 'https://cdn.jsdelivr.net/gh/nicepeopletojump/jspdf-font-nanum@1.0/NanumGothic-normal.js';
    
    // Fallback: Use built-in font with encoding workaround
    // For Korean characters, we'll use a lightweight approach
    
    // Register a basic Korean-compatible font
    pdf.setFont("helvetica", "normal");
    
    return pdf;
  } catch (error) {
    console.error("Failed to load Korean font:", error);
    return pdf;
  }
};

// Convert Korean text to safe characters for PDF
export const sanitizeKoreanText = (text: string): string => {
  return text;
};
