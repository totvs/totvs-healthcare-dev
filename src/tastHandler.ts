import * as http from 'http';
import { TastRunnerConfig, getConfig } from './configFile';

interface ApiResponse<T> {
    items: T[];
}

export interface TestSuite {
    suiteCode?: number;
    suiteName?: string;
    active?: boolean;
    squadCode?: number;
    squadName?: string;
}

export interface TestCase {
    cddCasoTeste?: number;
    nomCasoTeste?: string;
    suite?: number;
    codMeta?: number;
    codPeriodo?: number;
    dsInput?: string;
    dsObjetivo?: string;
    dsOutput?: string;
    dsPropath?: string;
    dtCriacao?: string;
    logExecutaRpw?: boolean;
    logOfensor?: boolean;
}

export interface TestResult {
    testCase: string;
    message: string;
    status: 'passed' | 'failed';
}

export class TastHandler {

    private readonly TOTVS_API_SUITES = '/dts/datasul-rest/resources/prg/htast/v1/suites/';
    private readonly TOTVS_API_TESTCASES = '/dts/datasul-rest/resources/prg/htast/v1/testCases/';
    private readonly TOTVS_API_TAST = '/dts/datasul-rest/resources/prg/htast/v1/api-tast/';
    private readonly TOTVS_API_PAGING_PARAMS = 'pageSize=999999';
    private readonly TOTVS_LOGIN = 'super:super';

    constructor() {
    }

    private getRunnerConfig(): TastRunnerConfig {
        let cfg = getConfig();
        return (cfg?.tast?.run || { });
    }

    private getBaseHeader(): http.RequestOptions {
        const runnerConfig = this.getRunnerConfig();
        const auth = 'Basic ' + Buffer.from(this.TOTVS_LOGIN).toString('base64');
        return <http.RequestOptions> {
            hostname: runnerConfig.totvs.host,
            port: runnerConfig.totvs.port,
            path: '/',
            method: 'GET',
            timeout: 5000,
            headers: {
                'Authorization': auth
            }
        };
    }

    private assemblyRunRequest(testCase: TestCase) {
        return {
            tmpCaseTest: [
                {
                    id: testCase.cddCasoTeste,
                    caseName: testCase.nomCasoTeste,
                    propathCase: testCase.dsPropath
                }
            ]
        };
    }

    private assemblyCRUDRequest(testCase: TestCase) {
        return {
            cddCasoTeste: 0,
            codMeta: testCase.codMeta,
            codPeriodo: testCase.codPeriodo,
            dsInput: '',
            dsIssuePacote: '',
            dsObjetivo: testCase.dsObjetivo,
            dsOutput: '',
            dsPropath: testCase.dsPropath,
            dtCriacao: new Date().toISOString(),
            logExecutaRpw: false,
            logOfensor: testCase.logOfensor,
            nomCasoTeste: testCase.nomCasoTeste,
            suite: testCase.suite
        };
    }

    getSuites(): Promise<ApiResponse<TestSuite>> {
        const options = this.getBaseHeader();
        options.path = this.TOTVS_API_SUITES + '?' + this.TOTVS_API_PAGING_PARAMS;
        return ApiRequest.request<TestSuite>(options);
    }

    getTestCases(): Promise<ApiResponse<TestCase>> {
        const options = this.getBaseHeader();
        options.path = this.TOTVS_API_TESTCASES + '?' + this.TOTVS_API_PAGING_PARAMS;
        options.timeout = 30000;
        return ApiRequest.request<TestCase>(options);
    }

    runTestCase(testCase: TestCase): Promise<ApiResponse<TestResult>> {
        const options = this.getBaseHeader();
        options.path = this.TOTVS_API_TAST;
        options.method = 'POST';
        options.timeout = 30000;
        return ApiRequest.request<TestResult>(options, this.assemblyRunRequest(testCase));
    }

    addTestCase(testCase: TestCase): Promise<any> {
        const options = this.getBaseHeader();
        options.path = this.TOTVS_API_TESTCASES;
        options.method = 'POST';
        return ApiRequest.request<any>(options, this.assemblyCRUDRequest(testCase));
    }

}

class ApiRequest {
    static request<T>(options: http.RequestOptions, postData?:any): Promise<ApiResponse<T>> {
        return new Promise((resolve,reject) => {
            let writeData;
            if (postData) {
                writeData = JSON.stringify(postData);
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Length'] =  Buffer.byteLength(writeData);
            }
            const request = http.request(options, (res) => {
                let timeoutControl = setTimeout(() => {
                    if (res.socket) {
                        res.socket.destroy();
                    }
                    res.emit('error');
                }, options.timeout);
        
                let resultData = '';
        
                res.on('data', (dataBuffer: Buffer) => {
                    clearTimeout(timeoutControl);
                    if ((res.statusCode >= 200) && (res.statusCode <= 299)) {
                        resultData += dataBuffer.toString();
                    }
                })
                .on('error', () => {
                    clearTimeout(timeoutControl);
                    reject();
                })
                .on('end', () => {
                    clearTimeout(timeoutControl);
                    let finalData: any;
                    try {
                        finalData = JSON.parse(resultData);
                        resolve(finalData);
                    }
                    catch {
                        reject();
                    }
                });
            });
            if (writeData) {
                request.write(writeData);
            }
            request.end();
        });
    }
    
}
