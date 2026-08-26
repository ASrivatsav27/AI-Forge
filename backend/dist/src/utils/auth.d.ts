export declare const auth: import("better-auth").Auth<{
    baseURL: string;
    trustedOrigins: string[];
    database: (options: import("better-auth").BetterAuthOptions) => import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
    emailAndPassword: {
        enabled: true;
    };
    socialProviders: {
        google: {
            clientId: string;
            clientSecret: string;
        };
        github: {
            clientId: string;
            clientSecret: string;
        };
    };
}>;
//# sourceMappingURL=auth.d.ts.map