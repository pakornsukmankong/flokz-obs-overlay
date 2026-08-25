import styles from "./donation-alert.module.css";

export type AlertDonation = { id: string; name: string; amount: number; message?: string };

/** การ์ด alert โดเนท (ใช้ทั้งใน overlay จริงและ preview หน้า setup) */
export function DonationAlertCard({ donation }: { donation: AlertDonation }) {
  return (
    <div key={donation.id} className={styles.card}>
      <div className={styles.head}>
        <span className={styles.name}>{donation.name}</span> โดเนท!
      </div>
      <div className={styles.amount}>฿{donation.amount.toLocaleString()}</div>
      {donation.message && <div className={styles.msg}>{donation.message}</div>}
    </div>
  );
}
