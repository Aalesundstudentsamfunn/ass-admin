export default function NotVolunteerPage() {
    return (
        <div className="flex min-h-svh w-full items-center justify-center bg-gradient-to-br from-green-100 via-white to-green-200 p-6">
            <div className="bg-white/80 rounded-2xl shadow-xl px-10 py-16 flex flex-col items-center max-w-md">
                <svg
                    className="mb-6 h-16 w-16 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#e5f9ee" />
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 9l-6 6m0-6l6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                    />
                </svg>
                <h1 className="text-3xl font-bold text-green-900 mb-2 text-center">
                    Ikke en frivillig i Åss
                </h1>
                <p className="text-muted-foreground text-center text-lg">
                    Denne siden er kun for frivillige medlemmer.<br />
                    Ta kontakt med en administrator hvis du mener dette er feil.
                </p>
            </div>
        </div>
    );
}
