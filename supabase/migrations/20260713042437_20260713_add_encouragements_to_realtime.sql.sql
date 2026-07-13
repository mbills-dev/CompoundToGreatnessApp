-- Enable real-time on the encouragements table so reaction bursts
-- are pushed to the recipient while the app is open.
ALTER PUBLICATION supabase_realtime ADD TABLE encouragements;
