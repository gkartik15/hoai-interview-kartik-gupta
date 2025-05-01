## Features

**Intelligent Invoice Processing**
  - AI-powered invoice data extraction
  - Automatic validation of invoice fields (dates, amounts, line items)
  - Error detection for invalid or incomplete invoices
  - Database storage for processed invoices
  - Support for various invoice formats and layouts
  - Validation checks for:
    - Invoice number uniqueness
    - Date format and validity
    - Mathematical accuracy of line items and totals
    - Required field completeness

**Interactive Invoice Management**
  - Responsive invoice table with expandable rows
  - Multi-column sorting (Invoice Date, Amount, Vendor Name)
  - Detailed line item view for each invoice
  - Dark mode support with consistent styling
  - Optimized scroll behavior for better user experience

## Technology

**[Next.js](https://nextjs.org) App Router**
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance

**[AI SDK](https://sdk.vercel.ai/docs)**
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports OpenAI (default), Anthropic, Cohere, and other model providers

**[shadcn/ui](https://ui.shadcn.com)**
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility

## Model Providers

This template ships with OpenAI `gpt-4o` as the default. However, with the [AI SDK](https://sdk.vercel.ai/docs), you can switch LLM providers to [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://sdk.vercel.ai/providers/ai-sdk-providers) with just a few lines of code.


## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Next.js AI Chatbot. 

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000/).

## Usage

### Invoice Processing Commands
1. Process a new invoice:
   ```
   Process this invoice: [paste invoice text or upload file]
   ```
   - The AI will extract and validate invoice data
   - For valid invoices: Shows extracted data and confirms storage
   - For invalid invoices: Highlights issues and suggests corrections

2. View processed invoices:
   ```
   Show all invoices
   ```
   - Displays interactive table of all processed invoices
   - Click column headers to sort by date, amount, or vendor
   - Click rows to view detailed line items

3. Validation feedback examples:
   - Valid invoice:
     ```
     ✓ Invoice processed successfully
     ✓ All required fields present
     ✓ Line items total matches invoice amount
     ✓ Dates are valid and properly formatted
     ✓ Stored in database with ID: [invoice_id]
     ```
   - Invalid invoice:
     ```
     ⚠ Invoice validation failed
     × Missing required field: invoice number
     × Line items total (1,200.00) doesn't match invoice amount (1,000.00)
     × Invalid date format: "2024/13/45"
     Please correct these issues and try again
     ```

### Invoice Table Features
- Sort by clicking column headers (Invoice Date, Amount, Vendor Name)
- Expand rows to view line items and transaction details
- Table supports both light and dark mode themes
- Responsive design adapts to different screen sizes