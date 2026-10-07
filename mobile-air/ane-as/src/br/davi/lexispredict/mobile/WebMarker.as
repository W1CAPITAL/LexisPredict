package br.davi.lexispredict.mobile {
    import flash.events.EventDispatcher;
    import flash.events.StatusEvent;
    import flash.external.ExtensionContext;

    public final class WebMarker extends EventDispatcher {
        public static const VERSION:String = "1.0.0";
        private var context:ExtensionContext;

        public function WebMarker() {
            context = ExtensionContext.createExtensionContext("br.davi.lexispredict.mobile.web", null);
            if (!context) throw new Error("ExtensionContext do LexisPredict retornou null.");
            context.addEventListener(StatusEvent.STATUS, onNativeStatus);
        }

        public function ping():Object { return context.call("ping"); }
        public function status():Object { return context.call("status"); }
        public function open(url:String):Object { return context.call("open", url); }
        public function reload():Object { return context.call("reload"); }
        public function canGoBack():Object { return context.call("canGoBack"); }
        public function goBack():Object { return context.call("goBack"); }
        public function show():Object { return context.call("show"); }
        public function hide():Object { return context.call("hide"); }
        public function close():Object { return context.call("close"); }

        public function dispose():void {
            if (!context) return;
            try { context.removeEventListener(StatusEvent.STATUS, onNativeStatus); } catch (e:Error) { }
            try { context.dispose(); } catch (e2:Error) { }
            context = null;
        }

        private function onNativeStatus(e:StatusEvent):void {
            dispatchEvent(new StatusEvent(StatusEvent.STATUS, false, false, e.code, e.level));
        }
    }
}
