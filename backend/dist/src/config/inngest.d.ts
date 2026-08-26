import { Inngest } from "inngest";
export declare const inngest: Inngest<{
    readonly id: "AI-Forge";
}>;
export declare const functions: import("inngest").InngestFunction<import("inngest").InngestFunction.Options<[{
    readonly event: "test/hello.world";
}], import("inngest").HandlerWithTriggers<{
    sendEvent: (idOrOptions: import("inngest").StepOptionsOrId, payload: import("inngest").SendEventPayload) => Promise<import("inngest/types").SendEventOutput<import("inngest").ClientOptionsFromInngest<Inngest<{
        readonly id: "AI-Forge";
    }>>>>;
    waitForSignal: <TData>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
        signal: string;
        timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        onConflict: "replace" | "fail";
    }) => Promise<{
        signal: string;
        data: import("inngest/types").Jsonify<TData>;
    } | null>;
    realtime: {
        publish: <TData>(idOrOptions: import("inngest").StepOptionsOrId, topicRef: import("inngest").Realtime.TopicRef<TData>, data: TData) => Promise<TData>;
    };
    sendSignal: (idOrOptions: import("inngest").StepOptionsOrId, opts: {
        signal: string;
        data?: unknown;
    }) => Promise<import("inngest").SendSignalResponse>;
    waitForEvent: <TOpts extends {
        event: string | import("inngest").EventType<string, any>;
        timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
    } & import("inngest").ExclusiveKeys<{
        match?: string;
        if?: string;
    }, "match", "if">>(idOrOptions: import("inngest").StepOptionsOrId, opts: TOpts) => Promise<TOpts extends {
        event: import("inngest").EventType<infer TName extends string, import("inngest").StandardSchemaV1<infer TData extends Record<string, unknown>>>;
    } ? {
        name: TName;
        data: TData;
        id: string;
        ts: number;
        v?: string;
        meta?: import("inngest").ReceivedEventMeta;
    } | null : TOpts extends {
        event: import("inngest").EventType<infer TName_1 extends string, undefined>;
    } ? {
        name: TName_1;
        data: Record<string, any>;
        id: string;
        ts: number;
        v?: string;
        meta?: import("inngest").ReceivedEventMeta;
    } | null : TOpts extends {
        event: infer TName_2 extends string;
        schema: import("inngest").StandardSchemaV1<infer TData_1 extends Record<string, unknown>>;
    } ? {
        name: TName_2;
        data: TData_1;
        id: string;
        ts: number;
        v?: string;
        meta?: import("inngest").ReceivedEventMeta;
    } | null : TOpts extends {
        event: infer TName_3 extends string;
    } ? {
        name: TName_3;
        data: Record<string, any>;
        id: string;
        ts: number;
        v?: string;
        meta?: import("inngest").ReceivedEventMeta;
    } | null : import("inngest").EventPayload<any> | null>;
    run: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
    ai: {
        infer: <TAdapter extends import("inngest").AiAdapter>(idOrOptions: import("inngest").StepOptionsOrId, options: {
            model: TAdapter;
            body: import("inngest").AiAdapter.Input<TAdapter>;
        }) => Promise<import("inngest").AiAdapter.Output<TAdapter>>;
        wrap: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
        models: {
            anthropic: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Anthropic.AiModelOptions], import("inngest").Anthropic.AiModel>;
            gemini: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Gemini.AiModelOptions], import("inngest").Gemini.AiModel>;
            openai: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").OpenAi.AiModelOptions], import("inngest").OpenAi.AiModel>;
            deepseek: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").DeepSeek.AiModelOptions], import("inngest").DeepSeek.AiModel>;
            grok: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Grok.AiModelOptions], import("inngest").Grok.AiModel>;
        };
    };
    sleep: (idOrOptions: import("inngest").StepOptionsOrId, time: number | string | import("inngest").DurationLike) => Promise<void>;
    sleepUntil: (idOrOptions: import("inngest").StepOptionsOrId, time: Date | string | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike) => Promise<void>;
    invoke: <TFunction extends import("inngest/types").InvokeTargetFunctionDefinition>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
        function: TFunction;
    } & Omit<import("inngest/types").TriggerEventFromFunction<TFunction>, "id"> & {
        meta?: import("inngest").EventMeta;
        timeout?: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
    }) => import("inngest/types").InvocationResult<import("inngest/types").Jsonify<import("inngest").GetFunctionOutputRaw<TFunction>>>;
    fetch: import("inngest").StepFetch;
}, [{
    readonly event: "test/hello.world";
}], import("inngest").FailureEventArgs<import("inngest").EventPayload<any>> & {
    step: {
        sendEvent: (idOrOptions: import("inngest").StepOptionsOrId, payload: import("inngest").SendEventPayload) => Promise<import("inngest/types").SendEventOutput<import("inngest").ClientOptionsFromInngest<Inngest<{
            readonly id: "AI-Forge";
        }>>>>;
        waitForSignal: <TData>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
            signal: string;
            timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
            onConflict: "replace" | "fail";
        }) => Promise<{
            signal: string;
            data: import("inngest/types").Jsonify<TData>;
        } | null>;
        realtime: {
            publish: <TData>(idOrOptions: import("inngest").StepOptionsOrId, topicRef: import("inngest").Realtime.TopicRef<TData>, data: TData) => Promise<TData>;
        };
        sendSignal: (idOrOptions: import("inngest").StepOptionsOrId, opts: {
            signal: string;
            data?: unknown;
        }) => Promise<import("inngest").SendSignalResponse>;
        waitForEvent: <TOpts extends {
            event: string | import("inngest").EventType<string, any>;
            timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        } & import("inngest").ExclusiveKeys<{
            match?: string;
            if?: string;
        }, "match", "if">>(idOrOptions: import("inngest").StepOptionsOrId, opts: TOpts) => Promise<TOpts extends {
            event: import("inngest").EventType<infer TName extends string, import("inngest").StandardSchemaV1<infer TData extends Record<string, unknown>>>;
        } ? {
            name: TName;
            data: TData;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: import("inngest").EventType<infer TName_1 extends string, undefined>;
        } ? {
            name: TName_1;
            data: Record<string, any>;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: infer TName_2 extends string;
            schema: import("inngest").StandardSchemaV1<infer TData_1 extends Record<string, unknown>>;
        } ? {
            name: TName_2;
            data: TData_1;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: infer TName_3 extends string;
        } ? {
            name: TName_3;
            data: Record<string, any>;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : import("inngest").EventPayload<any> | null>;
        run: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
        ai: {
            infer: <TAdapter extends import("inngest").AiAdapter>(idOrOptions: import("inngest").StepOptionsOrId, options: {
                model: TAdapter;
                body: import("inngest").AiAdapter.Input<TAdapter>;
            }) => Promise<import("inngest").AiAdapter.Output<TAdapter>>;
            wrap: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
            models: {
                anthropic: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Anthropic.AiModelOptions], import("inngest").Anthropic.AiModel>;
                gemini: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Gemini.AiModelOptions], import("inngest").Gemini.AiModel>;
                openai: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").OpenAi.AiModelOptions], import("inngest").OpenAi.AiModel>;
                deepseek: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").DeepSeek.AiModelOptions], import("inngest").DeepSeek.AiModel>;
                grok: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Grok.AiModelOptions], import("inngest").Grok.AiModel>;
            };
        };
        sleep: (idOrOptions: import("inngest").StepOptionsOrId, time: number | string | import("inngest").DurationLike) => Promise<void>;
        sleepUntil: (idOrOptions: import("inngest").StepOptionsOrId, time: Date | string | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike) => Promise<void>;
        invoke: <TFunction extends import("inngest/types").InvokeTargetFunctionDefinition>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
            function: TFunction;
        } & Omit<import("inngest/types").TriggerEventFromFunction<TFunction>, "id"> & {
            meta?: import("inngest").EventMeta;
            timeout?: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        }) => import("inngest/types").InvocationResult<import("inngest/types").Jsonify<import("inngest").GetFunctionOutputRaw<TFunction>>>;
        fetch: import("inngest").StepFetch;
    };
}>>, ({ event, step }: Omit<{
    defer: import("inngest/types").DeferFn;
    event: {
        data: {
            [x: string]: any;
        };
        id: string;
        name: "inngest/function.invoked";
        meta?: import("inngest").ReceivedEventMeta;
        ts: number;
        v: string;
    } | {
        data: {
            [x: string]: any;
        };
        id: string;
        name: "test/hello.world";
        meta?: import("inngest").ReceivedEventMeta;
        ts: number;
        v: string;
    };
    events: [{
        data: {
            [x: string]: any;
        };
        id: string;
        name: "inngest/function.invoked";
        meta?: import("inngest").ReceivedEventMeta;
        ts: number;
        v: string;
    } | {
        data: {
            [x: string]: any;
        };
        id: string;
        name: "test/hello.world";
        meta?: import("inngest").ReceivedEventMeta;
        ts: number;
        v: string;
    }, ...({
        data: {
            [x: string]: any;
        };
        id: string;
        name: "inngest/function.invoked";
        meta?: import("inngest").ReceivedEventMeta;
        ts: number;
        v: string;
    } | {
        data: {
            [x: string]: any;
        };
        id: string;
        name: "test/hello.world";
        meta?: import("inngest").ReceivedEventMeta;
        ts: number;
        v: string;
    })[]];
    runId: string;
    requestId?: string;
    jobId?: string;
    step: {
        sendEvent: (idOrOptions: import("inngest").StepOptionsOrId, payload: import("inngest").SendEventPayload) => Promise<import("inngest/types").SendEventOutput<import("inngest").ClientOptionsFromInngest<Inngest<{
            readonly id: "AI-Forge";
        }>>>>;
        waitForSignal: <TData>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
            signal: string;
            timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
            onConflict: "replace" | "fail";
        }) => Promise<{
            signal: string;
            data: import("inngest/types").Jsonify<TData>;
        } | null>;
        realtime: {
            publish: <TData>(idOrOptions: import("inngest").StepOptionsOrId, topicRef: import("inngest").Realtime.TopicRef<TData>, data: TData) => Promise<TData>;
        };
        sendSignal: (idOrOptions: import("inngest").StepOptionsOrId, opts: {
            signal: string;
            data?: unknown;
        }) => Promise<import("inngest").SendSignalResponse>;
        waitForEvent: <TOpts extends {
            event: string | import("inngest").EventType<string, any>;
            timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        } & import("inngest").ExclusiveKeys<{
            match?: string;
            if?: string;
        }, "match", "if">>(idOrOptions: import("inngest").StepOptionsOrId, opts: TOpts) => Promise<TOpts extends {
            event: import("inngest").EventType<infer TName extends string, import("inngest").StandardSchemaV1<infer TData extends Record<string, unknown>>>;
        } ? {
            name: TName;
            data: TData;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: import("inngest").EventType<infer TName_1 extends string, undefined>;
        } ? {
            name: TName_1;
            data: Record<string, any>;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: infer TName_2 extends string;
            schema: import("inngest").StandardSchemaV1<infer TData_1 extends Record<string, unknown>>;
        } ? {
            name: TName_2;
            data: TData_1;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: infer TName_3 extends string;
        } ? {
            name: TName_3;
            data: Record<string, any>;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : import("inngest").EventPayload<any> | null>;
        run: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
        ai: {
            infer: <TAdapter extends import("inngest").AiAdapter>(idOrOptions: import("inngest").StepOptionsOrId, options: {
                model: TAdapter;
                body: import("inngest").AiAdapter.Input<TAdapter>;
            }) => Promise<import("inngest").AiAdapter.Output<TAdapter>>;
            wrap: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
            models: {
                anthropic: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Anthropic.AiModelOptions], import("inngest").Anthropic.AiModel>;
                gemini: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Gemini.AiModelOptions], import("inngest").Gemini.AiModel>;
                openai: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").OpenAi.AiModelOptions], import("inngest").OpenAi.AiModel>;
                deepseek: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").DeepSeek.AiModelOptions], import("inngest").DeepSeek.AiModel>;
                grok: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Grok.AiModelOptions], import("inngest").Grok.AiModel>;
            };
        };
        sleep: (idOrOptions: import("inngest").StepOptionsOrId, time: number | string | import("inngest").DurationLike) => Promise<void>;
        sleepUntil: (idOrOptions: import("inngest").StepOptionsOrId, time: Date | string | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike) => Promise<void>;
        invoke: <TFunction extends import("inngest/types").InvokeTargetFunctionDefinition>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
            function: TFunction;
        } & Omit<import("inngest/types").TriggerEventFromFunction<TFunction>, "id"> & {
            meta?: import("inngest").EventMeta;
            timeout?: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        }) => import("inngest/types").InvocationResult<import("inngest/types").Jsonify<import("inngest").GetFunctionOutputRaw<TFunction>>>;
        fetch: import("inngest").StepFetch;
    };
    group: ReturnType<(deps?: import("inngest").GroupToolsDeps) => import("inngest").GroupTools>;
    attempt: number;
    maxAttempts?: number;
}, "step"> & {
    step: {
        sendEvent: (idOrOptions: import("inngest").StepOptionsOrId, payload: import("inngest").SendEventPayload) => Promise<import("inngest/types").SendEventOutput<import("inngest").ClientOptionsFromInngest<Inngest<{
            readonly id: "AI-Forge";
        }>>>>;
        waitForSignal: <TData>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
            signal: string;
            timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
            onConflict: "replace" | "fail";
        }) => Promise<{
            signal: string;
            data: import("inngest/types").Jsonify<TData>;
        } | null>;
        realtime: {
            publish: <TData>(idOrOptions: import("inngest").StepOptionsOrId, topicRef: import("inngest").Realtime.TopicRef<TData>, data: TData) => Promise<TData>;
        };
        sendSignal: (idOrOptions: import("inngest").StepOptionsOrId, opts: {
            signal: string;
            data?: unknown;
        }) => Promise<import("inngest").SendSignalResponse>;
        waitForEvent: <TOpts extends {
            event: string | import("inngest").EventType<string, any>;
            timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        } & import("inngest").ExclusiveKeys<{
            match?: string;
            if?: string;
        }, "match", "if">>(idOrOptions: import("inngest").StepOptionsOrId, opts: TOpts) => Promise<TOpts extends {
            event: import("inngest").EventType<infer TName extends string, import("inngest").StandardSchemaV1<infer TData extends Record<string, unknown>>>;
        } ? {
            name: TName;
            data: TData;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: import("inngest").EventType<infer TName_1 extends string, undefined>;
        } ? {
            name: TName_1;
            data: Record<string, any>;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: infer TName_2 extends string;
            schema: import("inngest").StandardSchemaV1<infer TData_1 extends Record<string, unknown>>;
        } ? {
            name: TName_2;
            data: TData_1;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: infer TName_3 extends string;
        } ? {
            name: TName_3;
            data: Record<string, any>;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : import("inngest").EventPayload<any> | null>;
        run: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
        ai: {
            infer: <TAdapter extends import("inngest").AiAdapter>(idOrOptions: import("inngest").StepOptionsOrId, options: {
                model: TAdapter;
                body: import("inngest").AiAdapter.Input<TAdapter>;
            }) => Promise<import("inngest").AiAdapter.Output<TAdapter>>;
            wrap: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
            models: {
                anthropic: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Anthropic.AiModelOptions], import("inngest").Anthropic.AiModel>;
                gemini: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Gemini.AiModelOptions], import("inngest").Gemini.AiModel>;
                openai: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").OpenAi.AiModelOptions], import("inngest").OpenAi.AiModel>;
                deepseek: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").DeepSeek.AiModelOptions], import("inngest").DeepSeek.AiModel>;
                grok: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Grok.AiModelOptions], import("inngest").Grok.AiModel>;
            };
        };
        sleep: (idOrOptions: import("inngest").StepOptionsOrId, time: number | string | import("inngest").DurationLike) => Promise<void>;
        sleepUntil: (idOrOptions: import("inngest").StepOptionsOrId, time: Date | string | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike) => Promise<void>;
        invoke: <TFunction extends import("inngest/types").InvokeTargetFunctionDefinition>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
            function: TFunction;
        } & Omit<import("inngest/types").TriggerEventFromFunction<TFunction>, "id"> & {
            meta?: import("inngest").EventMeta;
            timeout?: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        }) => import("inngest/types").InvocationResult<import("inngest/types").Jsonify<import("inngest").GetFunctionOutputRaw<TFunction>>>;
        fetch: import("inngest").StepFetch;
    };
}) => Promise<{
    message: string;
}>, import("inngest").HandlerWithTriggers<{
    sendEvent: (idOrOptions: import("inngest").StepOptionsOrId, payload: import("inngest").SendEventPayload) => Promise<import("inngest/types").SendEventOutput<import("inngest").ClientOptionsFromInngest<Inngest<{
        readonly id: "AI-Forge";
    }>>>>;
    waitForSignal: <TData>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
        signal: string;
        timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        onConflict: "replace" | "fail";
    }) => Promise<{
        signal: string;
        data: import("inngest/types").Jsonify<TData>;
    } | null>;
    realtime: {
        publish: <TData>(idOrOptions: import("inngest").StepOptionsOrId, topicRef: import("inngest").Realtime.TopicRef<TData>, data: TData) => Promise<TData>;
    };
    sendSignal: (idOrOptions: import("inngest").StepOptionsOrId, opts: {
        signal: string;
        data?: unknown;
    }) => Promise<import("inngest").SendSignalResponse>;
    waitForEvent: <TOpts extends {
        event: string | import("inngest").EventType<string, any>;
        timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
    } & import("inngest").ExclusiveKeys<{
        match?: string;
        if?: string;
    }, "match", "if">>(idOrOptions: import("inngest").StepOptionsOrId, opts: TOpts) => Promise<TOpts extends {
        event: import("inngest").EventType<infer TName extends string, import("inngest").StandardSchemaV1<infer TData extends Record<string, unknown>>>;
    } ? {
        name: TName;
        data: TData;
        id: string;
        ts: number;
        v?: string;
        meta?: import("inngest").ReceivedEventMeta;
    } | null : TOpts extends {
        event: import("inngest").EventType<infer TName_1 extends string, undefined>;
    } ? {
        name: TName_1;
        data: Record<string, any>;
        id: string;
        ts: number;
        v?: string;
        meta?: import("inngest").ReceivedEventMeta;
    } | null : TOpts extends {
        event: infer TName_2 extends string;
        schema: import("inngest").StandardSchemaV1<infer TData_1 extends Record<string, unknown>>;
    } ? {
        name: TName_2;
        data: TData_1;
        id: string;
        ts: number;
        v?: string;
        meta?: import("inngest").ReceivedEventMeta;
    } | null : TOpts extends {
        event: infer TName_3 extends string;
    } ? {
        name: TName_3;
        data: Record<string, any>;
        id: string;
        ts: number;
        v?: string;
        meta?: import("inngest").ReceivedEventMeta;
    } | null : import("inngest").EventPayload<any> | null>;
    run: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
    ai: {
        infer: <TAdapter extends import("inngest").AiAdapter>(idOrOptions: import("inngest").StepOptionsOrId, options: {
            model: TAdapter;
            body: import("inngest").AiAdapter.Input<TAdapter>;
        }) => Promise<import("inngest").AiAdapter.Output<TAdapter>>;
        wrap: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
        models: {
            anthropic: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Anthropic.AiModelOptions], import("inngest").Anthropic.AiModel>;
            gemini: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Gemini.AiModelOptions], import("inngest").Gemini.AiModel>;
            openai: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").OpenAi.AiModelOptions], import("inngest").OpenAi.AiModel>;
            deepseek: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").DeepSeek.AiModelOptions], import("inngest").DeepSeek.AiModel>;
            grok: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Grok.AiModelOptions], import("inngest").Grok.AiModel>;
        };
    };
    sleep: (idOrOptions: import("inngest").StepOptionsOrId, time: number | string | import("inngest").DurationLike) => Promise<void>;
    sleepUntil: (idOrOptions: import("inngest").StepOptionsOrId, time: Date | string | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike) => Promise<void>;
    invoke: <TFunction extends import("inngest/types").InvokeTargetFunctionDefinition>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
        function: TFunction;
    } & Omit<import("inngest/types").TriggerEventFromFunction<TFunction>, "id"> & {
        meta?: import("inngest").EventMeta;
        timeout?: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
    }) => import("inngest/types").InvocationResult<import("inngest/types").Jsonify<import("inngest").GetFunctionOutputRaw<TFunction>>>;
    fetch: import("inngest").StepFetch;
}, [{
    readonly event: "test/hello.world";
}], import("inngest").FailureEventArgs<import("inngest").EventPayload<any>> & {
    step: {
        sendEvent: (idOrOptions: import("inngest").StepOptionsOrId, payload: import("inngest").SendEventPayload) => Promise<import("inngest/types").SendEventOutput<import("inngest").ClientOptionsFromInngest<Inngest<{
            readonly id: "AI-Forge";
        }>>>>;
        waitForSignal: <TData>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
            signal: string;
            timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
            onConflict: "replace" | "fail";
        }) => Promise<{
            signal: string;
            data: import("inngest/types").Jsonify<TData>;
        } | null>;
        realtime: {
            publish: <TData>(idOrOptions: import("inngest").StepOptionsOrId, topicRef: import("inngest").Realtime.TopicRef<TData>, data: TData) => Promise<TData>;
        };
        sendSignal: (idOrOptions: import("inngest").StepOptionsOrId, opts: {
            signal: string;
            data?: unknown;
        }) => Promise<import("inngest").SendSignalResponse>;
        waitForEvent: <TOpts extends {
            event: string | import("inngest").EventType<string, any>;
            timeout: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        } & import("inngest").ExclusiveKeys<{
            match?: string;
            if?: string;
        }, "match", "if">>(idOrOptions: import("inngest").StepOptionsOrId, opts: TOpts) => Promise<TOpts extends {
            event: import("inngest").EventType<infer TName extends string, import("inngest").StandardSchemaV1<infer TData extends Record<string, unknown>>>;
        } ? {
            name: TName;
            data: TData;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: import("inngest").EventType<infer TName_1 extends string, undefined>;
        } ? {
            name: TName_1;
            data: Record<string, any>;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: infer TName_2 extends string;
            schema: import("inngest").StandardSchemaV1<infer TData_1 extends Record<string, unknown>>;
        } ? {
            name: TName_2;
            data: TData_1;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : TOpts extends {
            event: infer TName_3 extends string;
        } ? {
            name: TName_3;
            data: Record<string, any>;
            id: string;
            ts: number;
            v?: string;
            meta?: import("inngest").ReceivedEventMeta;
        } | null : import("inngest").EventPayload<any> | null>;
        run: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
        ai: {
            infer: <TAdapter extends import("inngest").AiAdapter>(idOrOptions: import("inngest").StepOptionsOrId, options: {
                model: TAdapter;
                body: import("inngest").AiAdapter.Input<TAdapter>;
            }) => Promise<import("inngest").AiAdapter.Output<TAdapter>>;
            wrap: <TFn extends (...args: any[]) => unknown>(idOrOptions: import("inngest").StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<import("inngest/types").Jsonify<TFn extends (...args: Parameters<TFn>) => Promise<infer U> ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>;
            models: {
                anthropic: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Anthropic.AiModelOptions], import("inngest").Anthropic.AiModel>;
                gemini: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Gemini.AiModelOptions], import("inngest").Gemini.AiModel>;
                openai: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").OpenAi.AiModelOptions], import("inngest").OpenAi.AiModel>;
                deepseek: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").DeepSeek.AiModelOptions], import("inngest").DeepSeek.AiModel>;
                grok: import("inngest").AiAdapter.ModelCreator<[options: import("inngest").Grok.AiModelOptions], import("inngest").Grok.AiModel>;
            };
        };
        sleep: (idOrOptions: import("inngest").StepOptionsOrId, time: number | string | import("inngest").DurationLike) => Promise<void>;
        sleepUntil: (idOrOptions: import("inngest").StepOptionsOrId, time: Date | string | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike) => Promise<void>;
        invoke: <TFunction extends import("inngest/types").InvokeTargetFunctionDefinition>(idOrOptions: import("inngest").StepOptionsOrId, opts: {
            function: TFunction;
        } & Omit<import("inngest/types").TriggerEventFromFunction<TFunction>, "id"> & {
            meta?: import("inngest").EventMeta;
            timeout?: number | string | Date | import("inngest").DurationLike | import("inngest").InstantLike | import("inngest").ZonedDateTimeLike;
        }) => import("inngest/types").InvocationResult<import("inngest/types").Jsonify<import("inngest").GetFunctionOutputRaw<TFunction>>>;
        fetch: import("inngest").StepFetch;
    };
}>, Inngest<{
    readonly id: "AI-Forge";
}>, [{
    readonly event: "test/hello.world";
}]>[];
//# sourceMappingURL=inngest.d.ts.map