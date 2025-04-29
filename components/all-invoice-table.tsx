import React, { useState } from 'react';

export function AllInvoicesTable({ invoices }: { invoices: any[] }) {
  const [sortBy, setSortBy] = useState('invoiceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  // Sorting logic
  const sortedInvoices = [...invoices].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    // For vendor, compare as string
    if (sortBy === 'vendorName') {
      aValue = aValue?.toLowerCase() || '';
      bValue = bValue?.toLowerCase() || '';
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }

    // For amount, compare as number
    if (sortBy === 'amount') {
      return sortDirection === 'asc'
        ? aValue - bValue
        : bValue - aValue;
    }

    // For dates, compare as Date
    if (sortBy === 'invoiceDate' || sortBy === 'dueDate') {
      return sortDirection === 'asc'
        ? new Date(aValue).getTime() - new Date(bValue).getTime()
        : new Date(bValue).getTime() - new Date(aValue).getTime();
    }

    return 0;
  });

  if (!invoices.length) return <div className="text-muted-foreground">No invoices processed yet.</div>;

  return (
    <div className="flex justify-center w-full">
      <div className="bg-background rounded-2xl shadow p-4 w-full max-w-3xl">
        <h2 className="text-lg font-semibold mb-4 text-primary">All Invoices</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 rounded-2xl">
            <thead>
              <tr className="text-left text-sm text-muted-foreground">
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2 cursor-pointer select-none"
    onClick={() => {
      if (sortBy === 'invoiceDate') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
      setSortBy('invoiceDate');
    }}>Invoice Date {sortBy === 'invoiceDate' && (sortDirection === 'asc' ? '▲' : '▼')} </th>
                <th className="px-3 py-2">Due Date</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Line Items</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr
                  key={inv.id}
                  className="bg-white dark:bg-zinc-900 rounded-2xl shadow border border-border"
                >
                  <td className="px-3 py-2 rounded-l-2xl">{inv.invoiceNumber}</td>
                  <td className="px-3 py-2">{inv.customerName}</td>
                  <td className="px-3 py-2">{inv.vendorName}</td>
                  <td className="px-3 py-2">{inv.invoiceDate}</td>
                  <td className="px-3 py-2">{inv.dueDate}</td>
                  <td className="px-3 py-2">${inv.amount?.toFixed(2)}</td>
                  <td className="px-3 py-2 rounded-r-2xl">
                    <ul className="list-disc list-inside space-y-1">
                      {inv.lineItems?.map((item: any, idx: number) => (
                        <li key={idx} className="text-xs">
                          {item.description} (Qty: {item.quantity}, Unit: ${item.unitPrice.toFixed(2)}, Total: ${item.total.toFixed(2)})
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}