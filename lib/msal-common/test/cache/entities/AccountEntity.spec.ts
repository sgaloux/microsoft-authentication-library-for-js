import { expect } from "chai";
import { AccountEntity } from "../../../src/cache/entities/AccountEntity";
import { mockAccountEntity, mockIdTokenEntity } from "./cacheConstants";
import { AuthToken } from "../../../src/account/AuthToken";
import { AuthorityFactory } from "../../../src/authority/AuthorityFactory";
import { CacheAccountType, Constants } from "../../../src/utils/Constants";
import { NetworkRequestOptions, INetworkModule } from "../../../src/network/INetworkModule";
import { ICrypto, PkceCodes } from "../../../src/crypto/ICrypto";
import { RANDOM_TEST_GUID, TEST_DATA_CLIENT_INFO, TEST_CONFIG, TEST_TOKENS, TEST_URIS, TEST_POP_VALUES, PREFERRED_CACHE_ALIAS } from "../../utils/StringConstants";
import sinon from "sinon";
import { AuthorityType, ClientAuthError, ClientAuthErrorMessage, Logger, LogLevel, ProtocolMode } from "../../../src";
import { ClientTestUtils } from "../../client/ClientTestUtils";
import { AccountInfo } from "../../../dist/src";

const cryptoInterface: ICrypto = {
    createNewGuid(): string {
        return RANDOM_TEST_GUID;
    },
    base64Decode(input: string): string {
        switch (input) {
            case TEST_POP_VALUES.ENCODED_REQ_CNF:
                return TEST_POP_VALUES.DECODED_REQ_CNF;
            case TEST_DATA_CLIENT_INFO.TEST_CACHE_RAW_CLIENT_INFO:
                return TEST_DATA_CLIENT_INFO.TEST_CACHE_DECODED_CLIENT_INFO;
            case TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS:
                return TEST_DATA_CLIENT_INFO.TEST_CACHE_DECODED_CLIENT_INFO_GUIDS
            default:
                return input;
        }
    },
    base64Encode(input: string): string {
        switch (input) {
            case TEST_POP_VALUES.DECODED_REQ_CNF:
                TEST_POP_VALUES.ENCODED_REQ_CNF;
            case "uid":
                return "dWlk";
            case "utid":
                return "dXRpZA==";
            default:
                return input;
        }
    },
    async generatePkceCodes(): Promise<PkceCodes> {
        return {
            challenge: TEST_CONFIG.TEST_CHALLENGE,
            verifier: TEST_CONFIG.TEST_VERIFIER,
        };
    },
    async getPublicKeyThumbprint(): Promise<string> {
        return TEST_POP_VALUES.KID;
    },
    async signJwt(): Promise<string> {
        return "";
    }
};

const networkInterface: INetworkModule = {
    sendGetRequestAsync<T>(
        url: string,
        options?: NetworkRequestOptions
    ): T {
        return null;
    },
    sendPostRequestAsync<T>(
        url: string,
        options?: NetworkRequestOptions
    ): T {
        return null;
    }
};

const authority =  AuthorityFactory.createInstance(
    Constants.DEFAULT_AUTHORITY,
    networkInterface,
    ProtocolMode.AAD
);

const loggerOptions = {
    loggerCallback: (level: LogLevel, message: string, containsPii: boolean): void => {
        console.log(`Log level: ${level} Message: ${message}`);
    },
    piiLoggingEnabled: true,
    logLevel: LogLevel.Verbose
};

describe("AccountEntity.ts Unit Tests", () => {
    beforeEach(() => {
        ClientTestUtils.setCloudDiscoveryMetadataStubs();
    });

    afterEach(() => {
        sinon.restore();
    });

    it("Verify an AccountEntity", () => {
        const ac = new AccountEntity();
        expect(ac instanceof AccountEntity);
    });

    it("generate an AccountEntityKey", () => {
        const ac = new AccountEntity();
        Object.assign(ac, mockAccountEntity);
        expect(ac.generateAccountKey()).to.eql(
            "uid.utid-login.microsoftonline.com-microsoft"
        );
    });

    it("throws error if account entity is not assigned a type", () => {
        const ac = new AccountEntity();
        expect(() => ac.generateType()).to.throw(ClientAuthError);
        expect(() => ac.generateType()).to.throw(ClientAuthErrorMessage.unexpectedAccountType.desc);
    });

    it("generate type of the cache", () => {
        const ac = new AccountEntity();
        Object.assign(ac, mockAccountEntity);
        expect(ac.generateType()).to.eql(1003);
    });

    it("create an Account", () => {
        // Set up stubs
        const idTokenClaims = {
            "ver": "2.0",
            "iss": `${TEST_URIS.DEFAULT_INSTANCE}9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`,
            "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
            "exp": 1536361411,
            "name": "Abe Lincoln",
            "preferred_username": "AbeLi@microsoft.com",
            "oid": "00000000-0000-0000-66f3-3332eca7ea81",
            "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
            "nonce": "123523",
        };
        sinon.stub(AuthToken, "extractTokenClaims").returns(idTokenClaims);
        const idToken = new AuthToken(TEST_TOKENS.IDTOKEN_V2, cryptoInterface);

        const logger = new Logger(loggerOptions);
        const homeAccountId = AccountEntity.generateHomeAccountId(
            TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
            AuthorityType.Default,
            logger,
            cryptoInterface,
            idToken);

        const acc = AccountEntity.createAccount(
            TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
            homeAccountId,
            authority,
            idToken
        );

        expect(acc.generateAccountKey()).to.eql(`${homeAccountId}-login.windows.net-${idTokenClaims.tid}`);
        expect(acc.homeAccountId).to.eq(homeAccountId);
        expect(acc.environment).to.eq(PREFERRED_CACHE_ALIAS);
        expect(acc.realm).to.eq(idTokenClaims.tid);
        expect(acc.username).to.eq("AbeLi@microsoft.com");
        expect(acc.localAccountId).to.eql(idTokenClaims.oid);
        expect(acc.idTokenClaims).to.eq(idTokenClaims);
    });

    it("create an Account with sub instead of oid as localAccountId", () => {
        // Set up stubs
        const idTokenClaims = {
            "ver": "2.0",
            "iss": `${TEST_URIS.DEFAULT_INSTANCE}9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`,
            "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
            "exp": 1536361411,
            "name": "Abe Lincoln",
            "preferred_username": "AbeLi@microsoft.com",
            "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
            "nonce": "123523",
        };
        sinon.stub(AuthToken, "extractTokenClaims").returns(idTokenClaims);
        const idToken = new AuthToken(TEST_TOKENS.IDTOKEN_V2, cryptoInterface);

        const logger = new Logger(loggerOptions);
        const homeAccountId = AccountEntity.generateHomeAccountId(
            TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
            AuthorityType.Default,
            logger,
            cryptoInterface,
            idToken);

        const acc = AccountEntity.createAccount(
            TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
            homeAccountId,
            authority,
            idToken
        );

        expect(acc.generateAccountKey()).to.eql(`${homeAccountId}-login.windows.net-${idTokenClaims.tid}`);
        expect(acc.homeAccountId).to.eq(homeAccountId);
        expect(acc.environment).to.eq(PREFERRED_CACHE_ALIAS);
        expect(acc.realm).to.eq(idTokenClaims.tid);
        expect(acc.username).to.eq("AbeLi@microsoft.com");
        expect(acc.localAccountId).to.eql(idTokenClaims.sub);
        expect(acc.idTokenClaims).to.eq(idTokenClaims);
    });

    it("create an Account with emails claim instead of preferred_username claim", () => {
        // Set up stubs
        const idTokenClaims = {
            "ver": "2.0",
            "iss": `${TEST_URIS.DEFAULT_INSTANCE}9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`,
            "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
            "exp": 1536361411,
            "name": "Abe Lincoln",
            "emails": ["AbeLi@microsoft.com"],
            "oid": "00000000-0000-0000-66f3-3332eca7ea81",
            "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
            "nonce": "123523",
        };
        sinon.stub(AuthToken, "extractTokenClaims").returns(idTokenClaims);
		const idToken = new AuthToken(TEST_TOKENS.IDTOKEN_V2, cryptoInterface);

        const logger = new Logger(loggerOptions);
        const homeAccountId = AccountEntity.generateHomeAccountId(
            TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
            AuthorityType.Default,
            logger,
            cryptoInterface,
            idToken);

        const acc = AccountEntity.createAccount(
            TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
            homeAccountId,
            authority,
            idToken
        );
        expect(acc.generateAccountKey()).to.eql(`${homeAccountId}-login.windows.net-${idTokenClaims.tid}`);
        expect(acc.homeAccountId).to.eq(homeAccountId);
        expect(acc.environment).to.eq(PREFERRED_CACHE_ALIAS);
        expect(acc.realm).to.eq(idTokenClaims.tid);
        expect(acc.username).to.eq("AbeLi@microsoft.com");
        expect(acc.localAccountId).to.eql(idTokenClaims.oid);
        expect(acc.idTokenClaims).to.eq(idTokenClaims);
    });

    it("create an Account no preferred_username or emails claim", () => {
        const authority =  AuthorityFactory.createInstance(
            Constants.DEFAULT_AUTHORITY,
            networkInterface,
            ProtocolMode.AAD
		);

        // Set up stubs
        const idTokenClaims = {
            "ver": "2.0",
            "iss": `${TEST_URIS.DEFAULT_INSTANCE}9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`,
            "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
            "exp": 1536361411,
            "name": "Abe Lincoln",
            "oid": "00000000-0000-0000-66f3-3332eca7ea81",
            "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
            "nonce": "123523",
        };
        sinon.stub(AuthToken, "extractTokenClaims").returns(idTokenClaims);
		const idToken = new AuthToken(TEST_TOKENS.IDTOKEN_V2, cryptoInterface);

        const logger = new Logger(loggerOptions);
        const homeAccountId = AccountEntity.generateHomeAccountId(
            TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
            AuthorityType.Default,
            logger,
            cryptoInterface,
            idToken);

        const acc = AccountEntity.createAccount(
            TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
            homeAccountId,
            authority,
            idToken
        );

        expect(acc.generateAccountKey()).to.eql(`${homeAccountId}-login.windows.net-${idTokenClaims.tid}`);
        expect(acc.homeAccountId).to.eq(homeAccountId);
        expect(acc.environment).to.eq(PREFERRED_CACHE_ALIAS);
        expect(acc.realm).to.eq(idTokenClaims.tid);
        expect(acc.username).to.eq("");
        expect(acc.localAccountId).to.eql(idTokenClaims.oid);
        expect(acc.idTokenClaims).to.eq(idTokenClaims);
    });

    it("creates a generic account", () => {
        const authority =  AuthorityFactory.createInstance(
            Constants.DEFAULT_AUTHORITY,
            networkInterface,
            ProtocolMode.OIDC
		);

        // Set up stubs
        const idTokenClaims = {
            "ver": "2.0",
            "iss": `${TEST_URIS.DEFAULT_INSTANCE}9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`,
            "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
            "exp": 1536361411,
            "name": "Abe Lincoln",
            "oid": "00000000-0000-0000-66f3-3332eca7ea81",
            "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
            "nonce": "123523",
            "upn": "testupn"
        };
        sinon.stub(AuthToken, "extractTokenClaims").returns(idTokenClaims);
		const idToken = new AuthToken(TEST_TOKENS.IDTOKEN_V2, cryptoInterface);

        const homeAccountId = "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ".toLowerCase();
        const acc = AccountEntity.createGenericAccount(
            authority,
            homeAccountId,
            idToken
        );

        expect(acc.generateAccountKey()).to.eql(`${idTokenClaims.sub.toLowerCase()}-login.windows.net-`);
        expect(acc.homeAccountId).to.eq(homeAccountId);
        expect(acc.environment).to.eq(PREFERRED_CACHE_ALIAS);
        expect(acc.realm).to.eq(""); // Realm empty for generic accounts
        expect(acc.username).to.eq("testupn");
        expect(acc.localAccountId).to.eq(idTokenClaims.oid);
        expect(acc.authorityType).to.eq(CacheAccountType.GENERIC_ACCOUNT_TYPE);
        expect(AccountEntity.isAccountEntity(acc)).to.eql(true);
        expect(acc.idTokenClaims).to.eq(idTokenClaims);
    });

    it("verify if an object is an account entity", () => {
        expect(AccountEntity.isAccountEntity(mockAccountEntity)).to.eql(true);
    });

    it("verify if an object is not an account entity", () => {
        expect(AccountEntity.isAccountEntity(mockIdTokenEntity)).to.eql(false);
    });

    describe("accountInfoIsEqual()", () => {
        let acc: AccountEntity;
        beforeEach(() => {
            // Set up stubs
            const idTokenClaims = {
                "ver": "2.0",
                "iss": `${TEST_URIS.DEFAULT_INSTANCE}9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`,
                "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
                "exp": 1536361411,
                "name": "Abe Lincoln",
                "preferred_username": "AbeLi@microsoft.com",
                "oid": "00000000-0000-0000-66f3-3332eca7ea81",
                "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
                "nonce": "123523",
            };
            sinon.stub(AuthToken, "extractTokenClaims").returns(idTokenClaims);
            const idToken = new AuthToken(TEST_TOKENS.IDTOKEN_V2, cryptoInterface);

            const logger = new Logger(loggerOptions);
            const homeAccountId = AccountEntity.generateHomeAccountId(
                TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
                AuthorityType.Default,
                logger,
                cryptoInterface,
                idToken);

            acc = AccountEntity.createAccount(
                TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO_GUIDS,
                homeAccountId,
                authority,
                idToken
            );
        })

        it("returns true if two account info objects have the same values", () => {
            const acc1: AccountInfo = acc.getAccountInfo();
            const acc2: AccountInfo = {...acc1};
            expect(AccountEntity.accountInfoIsEqual(acc1, acc2)).to.be.true;            
        });
    
        it("returns false if required AccountInfo parameters are not equal", () => {
            const acc1: AccountInfo = acc.getAccountInfo();
            const acc2: AccountInfo = {...acc1};
            const acc3: AccountInfo = {...acc1};
            const acc4: AccountInfo = {...acc1};
            const acc5: AccountInfo = {...acc1};
            const acc6: AccountInfo = {...acc1};
            const acc7: AccountInfo = {...acc1};
            const acc8: AccountInfo = {...acc1};
            acc2.homeAccountId = "mockHomeAccountId2";
            expect(AccountEntity.accountInfoIsEqual(acc1, acc2)).to.be.false;
            acc3.localAccountId = "mockLocalAccountId2";
            expect(AccountEntity.accountInfoIsEqual(acc1, acc3)).to.be.false;
            acc4.environment = "mockEnv2";
            expect(AccountEntity.accountInfoIsEqual(acc1, acc4)).to.be.false;
            acc5.tenantId = "mockTenant2";
            expect(AccountEntity.accountInfoIsEqual(acc1, acc5)).to.be.false;
            acc6.username = "mockUsername2";
            expect(AccountEntity.accountInfoIsEqual(acc1, acc6)).to.be.false;
            acc7.name = "mockName2";
            expect(AccountEntity.accountInfoIsEqual(acc1, acc7)).to.be.true;
            acc8.idTokenClaims = {};
            expect(AccountEntity.accountInfoIsEqual(acc1, acc8)).to.be.true;
        });

        it("returns false if an account info object is invalid", () => {
            const acc1: AccountInfo = null;
            const acc2: AccountInfo = acc.getAccountInfo();
            expect(AccountEntity.accountInfoIsEqual(acc1, acc2)).to.be.false;

            const acc3: AccountInfo = acc.getAccountInfo();
            const acc4: AccountInfo = null;
            expect(AccountEntity.accountInfoIsEqual(acc3, acc4)).to.be.false; 
            
            const acc5: AccountInfo = null;
            const acc6: AccountInfo = null;
            expect(AccountEntity.accountInfoIsEqual(acc5, acc6)).to.be.false; 
        });
    });
});

describe("AccountEntity.ts Unit Tests for ADFS", () => {
    beforeEach(() => {
        ClientTestUtils.setCloudDiscoveryMetadataStubsForADFS();
    });

    afterEach(() => {
        sinon.restore();
    });

    it("creates a generic ADFS account", () => {
        const authority = AuthorityFactory.createInstance(
            "https://myadfs.com/adfs",
            networkInterface,
            ProtocolMode.OIDC
        );

        // Set up stubs
        const idTokenClaims = {
            "ver": "2.0",
            "iss": `${TEST_URIS.DEFAULT_INSTANCE}9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`,
            "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
            "exp": 1536361411,
            "name": "Abe Lincoln",
            "oid": "00000000-0000-0000-66f3-3332eca7ea81",
            "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
            "nonce": "123523",
            "upn": "testupn"
        };
        sinon.stub(AuthToken, "extractTokenClaims").returns(idTokenClaims);
        const idToken = new AuthToken(TEST_TOKENS.IDTOKEN_V2, cryptoInterface);

        const homeAccountId = "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ".toLowerCase();
        const acc = AccountEntity.createGenericAccount(
            authority,
            homeAccountId,
            idToken
        );

        expect(acc.generateAccountKey()).to.eql(`${idTokenClaims.sub.toLowerCase()}-myadfs.com/adfs-`);
        expect(acc.homeAccountId).to.eq(homeAccountId);
        expect(acc.environment).to.eq("myadfs.com/adfs");
        expect(acc.realm).to.eq("");
        expect(acc.username).to.eq("testupn");
        expect(acc.localAccountId).to.eq(idTokenClaims.oid);
        expect(acc.authorityType).to.eq(CacheAccountType.ADFS_ACCOUNT_TYPE);
        expect(AccountEntity.isAccountEntity(acc)).to.eql(true);
        expect(acc.idTokenClaims).to.eq(idTokenClaims);
    });

    it("creates a generic ADFS account without OID", () => {
        const authority = AuthorityFactory.createInstance(
            "https://adfs.com/adfs",
            networkInterface,
            ProtocolMode.OIDC
        );

        // Set up stubs
        const idTokenClaims = {
            "ver": "2.0",
            "iss": `${TEST_URIS.DEFAULT_INSTANCE}9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`,
            "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
            "exp": 1536361411,
            "name": "Abe Lincoln",
            "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
            "nonce": "123523",
            "upn": "testupn"
        };
        sinon.stub(AuthToken, "extractTokenClaims").returns(idTokenClaims);
        const idToken = new AuthToken(TEST_TOKENS.IDTOKEN_V2, cryptoInterface);

        const homeAccountId = "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ".toLowerCase();
        const acc = AccountEntity.createGenericAccount(
            authority,
            homeAccountId,
            idToken
        );

        expect(acc.generateAccountKey()).to.eql(`${idTokenClaims.sub.toLowerCase()}-myadfs.com/adfs-`);
        expect(acc.homeAccountId).to.eq(homeAccountId);
        expect(acc.environment).to.eq("myadfs.com/adfs");
        expect(acc.realm).to.eq("");
        expect(acc.username).to.eq("testupn");
        expect(acc.authorityType).to.eq(CacheAccountType.ADFS_ACCOUNT_TYPE);
        expect(acc.localAccountId).to.eq(idTokenClaims.sub);
        expect(AccountEntity.isAccountEntity(acc)).to.eql(true);
        expect(acc.idTokenClaims).to.eq(idTokenClaims);
    });
});
