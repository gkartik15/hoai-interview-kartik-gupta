import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function AllInvoicesTable({ invoices }: { invoices: any[] }) {
  const [sortBy, setSortBy] = useState('invoiceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Sort function
  const sortedInvoices = [...invoices].sort((a, b) => {
    if (sortDirection === 'asc') {
      switch (sortBy) {
        case 'invoiceDate':
          return new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
        case 'amount':
          return (a.amount || 0) - (b.amount || 0);
        case 'vendorName':
          return (a.vendorName || '').localeCompare(b.vendorName || '');
        default:
          return 0;
      }
    } else {
      switch (sortBy) {
        case 'invoiceDate':
          return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'amount':
          return (b.amount || 0) - (a.amount || 0);
        case 'vendorName':
          return (b.vendorName || '').localeCompare(a.vendorName || '');
        default:
          return 0;
      }
    }
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const toggleRow = (invoiceId: string, event: React.MouseEvent) => {
    // Toggle row
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  return (
    <div className="flex justify-center w-full">
      <div className="bg-background rounded-2xl shadow p-4 w-full max-w-3xl">
        <h2 className="text-lg font-semibold mb-4 text-primary">All Invoices</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 rounded-2xl">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2">Invoice #</th>
                  <th className="px-3 py-2">Customer</th>
                  <th 
                    className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors group"
                    onClick={() => handleSort('vendorName')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Vendor 
                      <span className={`transition-opacity ${sortBy === 'vendorName' ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}>
                        {sortBy === 'vendorName' ? (sortDirection === 'asc' ? '▲' : '▼') : '▼'}
                      </span>
                    </span>
                  </th>
                  <th 
                    className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors group"
                    onClick={() => handleSort('invoiceDate')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Invoice Date 
                      <span className={`transition-opacity ${sortBy === 'invoiceDate' ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}>
                        {sortBy === 'invoiceDate' ? (sortDirection === 'asc' ? '▲' : '▼') : '▼'}
                      </span>
                    </span>
                  </th>
                  <th className="px-3 py-2">Due Date</th>
                  <th 
                    className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors group"
                    onClick={() => handleSort('amount')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Amount 
                      <span className={`transition-opacity ${sortBy === 'amount' ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}>
                        {sortBy === 'amount' ? (sortDirection === 'asc' ? '▲' : '▼') : '▼'}
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((inv: any) => (
                  <Fragment key={inv.id}>
                    <tr
                      className="bg-white dark:bg-zinc-900 rounded-2xl shadow border border-border hover:bg-secondary/50 transition-colors cursor-pointer select-none"
                      onClick={(e) => toggleRow(inv.id, e)}
                    >
                      <td className="px-3 py-2 rounded-l-2xl">
                        {expandedRows.has(inv.id) ? (
                          <ChevronDown size={16} className="text-muted-foreground" />
                        ) : (
                          <ChevronRight size={16} className="text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-2">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2">{inv.customerName}</td>
                      <td className="px-3 py-2">{inv.vendorName}</td>
                      <td className="px-3 py-2">{inv.invoiceDate}</td>
                      <td className="px-3 py-2">{inv.dueDate}</td>
                      <td className="px-3 py-2 rounded-r-2xl">${inv.amount?.toFixed(2)}</td>
                    </tr>
                    {expandedRows.has(inv.id) && (
                      <tr className="transition-all duration-300">
                        <td colSpan={7} className="px-0 py-0">
                          <div className="bg-secondary/30 rounded-xl mx-2 p-4 shadow-inner transform-gpu">
                            <table className="w-full">
                              <thead>
                                <tr className="text-sm text-muted-foreground border-b">
                                  <th className="text-left py-2">Description</th>
                                  <th className="text-right py-2">Quantity</th>
                                  <th className="text-right py-2">Unit Price</th>
                                  <th className="text-right py-2">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inv.lineItems?.map((item: any, idx: number) => (
                                  <tr key={idx} className="text-sm border-b last:border-0">
                                    <td className="py-2">{item.description}</td>
                                    <td className="text-right py-2">{item.quantity}</td>
                                    <td className="text-right py-2">${item.unitPrice.toFixed(2)}</td>
                                    <td className="text-right py-2">${item.total.toFixed(2)}</td>
                                  </tr>
                                ))}
                                <tr className="font-medium">
                                  <td colSpan={3} className="text-right py-2">Total:</td>
                                  <td className="text-right py-2">${inv.amount?.toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}