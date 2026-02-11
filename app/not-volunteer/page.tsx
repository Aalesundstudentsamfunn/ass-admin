export default function NotVoluntaryPage() {
    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <div className="max-w-md text-center space-y-4">
                <h1 className="text-2xl font-semibold">
                    Ingen tilgang
                </h1>

                <p className="text-muted-foreground">
                    Du er ikke registrert som frivillig og har derfor ikke tilgang til dette området.
                </p>

                <p className="text-muted-foreground">
                    Dersom dette ikke stemmer, vennligst kontakt IT-avdelingen.
                </p>
            </div>
        </div>
    )
}