import { useEffect, useMemo, useState } from "react";
import { notifyError } from "../../../lib/notification";
import OrderDetailModal from "./OrderDetailModal";
import OrdersTable from "./OrdersTable";
import { getOrderByID, listOrders } from "./api";
import type { Order } from "./types";

export default function OrdersPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState("");
  const [businessID, setBusinessID] = useState("");
  const [userID, setUserID] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [selectedOrderID, setSelectedOrderID] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const setOrderDetailQuery = (orderID: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (orderID) {
      url.searchParams.set("order_id", orderID);
    } else {
      url.searchParams.delete("order_id");
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const openDetailByID = async (orderID: string) => {
    setSelectedOrderID(orderID);
    setDetailOpen(true);
    setDetailLoading(true);
    setOrderDetailQuery(orderID);
    try {
      const res = await getOrderByID(orderID);
      setSelectedOrder({
        ...res.data.order,
        payments: res.data.payments || res.data.order.payments || [],
      });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to fetch order detail");
      setSelectedOrder(null);
      setDetailOpen(false);
      setSelectedOrderID("");
      setOrderDetailQuery(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const sortedItems = useMemo(() => {
    try {
      return [...items].sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      });
    } catch (e) {
      return items;
    }
  }, [items]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listOrders({
        q,
        business_id: businessID,
        user_id: userID,
        status,
        payment_status: paymentStatus,
        channel,
        from: from || undefined,
        to: to || undefined,
        page,
        limit,
      });
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch orders";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, limit, q, businessID, userID, status, paymentStatus, channel, from, to]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (orderId) {
      void openDetailByID(orderId);
    }
  }, []);

  const openDetail = async (order: Order) => {
    await openDetailByID(order.id);
  };

  const refreshSelectedOrder = async () => {
    if (!selectedOrderID) return;
    setDetailLoading(true);
    try {
      const res = await getOrderByID(selectedOrderID);
      setSelectedOrder({ ...res.data.order, payments: res.data.payments || res.data.order.payments || [] });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to refresh order detail");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Orders</h3>
          <p className="text-sm text-slate-600">Monitoring dan manajemen order dari channel web/POS.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData()}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Refresh
          </button>
          <a href="/admin/pos" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
            + New Order (POS)
          </a>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-9">
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search order number"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Business ID"
          value={businessID}
          onChange={(e) => {
            setPage(1);
            setBusinessID(e.target.value);
          }}
        />
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="User ID"
          value={userID}
          onChange={(e) => {
            setPage(1);
            setUserID(e.target.value);
          }}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All order status</option>
          <option value="pending">pending</option>
          <option value="confirmed">confirmed</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={paymentStatus}
          onChange={(e) => {
            setPage(1);
            setPaymentStatus(e.target.value);
          }}
        >
          <option value="">All payment status</option>
          <option value="unpaid">unpaid</option>
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="failed">failed</option>
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={channel}
          onChange={(e) => {
            setPage(1);
            setChannel(e.target.value);
          }}
        >
          <option value="">All channels</option>
          <option value="web">web</option>
          <option value="pos">pos</option>
        </select>
        <input
          type="date"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={from}
          onChange={(e) => {
            setPage(1);
            setFrom(e.target.value);
          }}
        />
        <input
          type="date"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={to}
          onChange={(e) => {
            setPage(1);
            setTo(e.target.value);
          }}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={limit}
          onChange={(e) => {
            setPage(1);
            setLimit(Number(e.target.value));
          }}
        >
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>

      <OrdersTable items={sortedItems} loading={loading} error={error} onView={openDetail} />

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-sm text-slate-600">Showing {sortedItems.length} of {total} orders</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <OrderDetailModal
        open={detailOpen}
        loading={detailLoading}
        order={selectedOrderID ? selectedOrder : null}
        onRefresh={refreshSelectedOrder}
        onClose={() => {
          setDetailOpen(false);
          setSelectedOrderID("");
          setSelectedOrder(null);
          setOrderDetailQuery(null);
        }}
      />
    </div>
  );
}
