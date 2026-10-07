package {
    import flash.desktop.NativeApplication;
    import flash.display.Sprite;
    import flash.display.StageAlign;
    import flash.display.StageScaleMode;
    import flash.events.Event;
    import flash.events.KeyboardEvent;
    import flash.events.StatusEvent;
    import flash.text.TextField;
    import flash.text.TextFormat;
    import flash.ui.Keyboard;
    import flash.utils.getDefinitionByName;

    public class LexisMobile extends Sprite {
        private static const APP_URL:String = "https://lexispredict.vercel.app/login?source=android-air";
        private var bridge:*;
        private var titleField:TextField;
        private var statusField:TextField;

        public function LexisMobile() {
            addEventListener(Event.ADDED_TO_STAGE, init);
        }

        private function init(e:Event):void {
            removeEventListener(Event.ADDED_TO_STAGE, init);
            stage.scaleMode = StageScaleMode.NO_SCALE;
            stage.align = StageAlign.TOP_LEFT;
            stage.frameRate = 30;
            drawSplash();
            stage.addEventListener(KeyboardEvent.KEY_DOWN, onKeyDown);
            NativeApplication.nativeApplication.addEventListener(Event.ACTIVATE, onActivate);

            try {
                var BridgeClass:Class = getDefinitionByName("br.davi.lexispredict.mobile.WebMarker") as Class;
                if (!BridgeClass) throw new Error("WebMarker não encontrado.");
                bridge = new BridgeClass();
                bridge.addEventListener(StatusEvent.STATUS, onNativeStatus);
                setStatus("Preparando ambiente seguro...");
                bridge.open(APP_URL);
            } catch (err:Error) {
                setStatus("Falha ao iniciar o aplicativo: " + err.message);
            }
        }

        private function drawSplash():void {
            graphics.clear();
            graphics.beginFill(0x070A12);
            graphics.drawRect(0, 0, stage.stageWidth, stage.stageHeight);
            graphics.endFill();

            titleField = new TextField();
            titleField.defaultTextFormat = new TextFormat("_sans", 28, 0xFFFFFF, true);
            titleField.text = "LEXISPREDICT";
            titleField.selectable = false;
            titleField.width = Math.max(260, stage.stageWidth - 48);
            titleField.height = 50;
            titleField.x = 24;
            titleField.y = Math.max(80, stage.stageHeight * 0.35);
            addChild(titleField);

            statusField = new TextField();
            statusField.defaultTextFormat = new TextFormat("_sans", 14, 0xA9B4CC, false);
            statusField.text = "Iniciando...";
            statusField.selectable = false;
            statusField.multiline = true;
            statusField.wordWrap = true;
            statusField.width = Math.max(260, stage.stageWidth - 64);
            statusField.height = 90;
            statusField.x = 32;
            statusField.y = titleField.y + 58;
            addChild(statusField);
        }

        private function setStatus(value:String):void {
            if (statusField) statusField.text = value;
        }

        private function onNativeStatus(e:StatusEvent):void {
            if (e.code == "ready") {
                setStatus("Conectado.");
            } else if (e.code == "progress") {
                setStatus("Carregando LexisPredict... " + e.level + "%");
            } else if (e.code == "offline") {
                setStatus("Sem conexão. O aplicativo tentará novamente.");
            } else if (e.code == "error") {
                setStatus(e.level || "Falha ao carregar.");
            } else if (e.code == "state" && e.level) {
                setStatus(e.level);
            }
        }

        private function onActivate(e:Event):void {
            try { if (bridge) bridge.show(); } catch (err:Error) { }
        }

        private function onKeyDown(e:KeyboardEvent):void {
            if (e.keyCode != Keyboard.BACK) return;
            e.preventDefault();
            try {
                if (bridge && Boolean(bridge.canGoBack())) {
                    bridge.goBack();
                    return;
                }
            } catch (err:Error) { }
            NativeApplication.nativeApplication.exit();
        }
    }
}
