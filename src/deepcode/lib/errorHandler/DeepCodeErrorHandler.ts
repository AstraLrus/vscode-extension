import * as vscode from "vscode";
import { statusCodes } from "../../constants/statusCodes";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { startDeepCodeCommand } from "../../utils/vscodeCommandsUtils";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import { IDE_NAME } from "../../constants/general";
import http from "../../http/requests";

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

class DeepCodeErrorHandler implements DeepCode.ErrorHandlerInterface {
  private async generalError(): Promise<void> {
    const { msg: errorMsg, button: tryButton } = deepCodeMessages.error;
    const button = await vscode.window.showErrorMessage(errorMsg, tryButton);
    if (button === tryButton) {
      startDeepCodeCommand();
    }
  }

  private async systemError(error: object): Promise<void> {
    const restartButton = deepCodeMessages.error.button;
    const pressed = await vscode.window.showErrorMessage(String(error), restartButton);
    if (pressed === restartButton) {
      startDeepCodeCommand();
    }
  }

  private async serverErrorHandler(extension: DeepCode.ExtensionInterface | any): Promise<void> {
    const { msg } = deepCodeMessages.noConnection;
    vscode.window.showErrorMessage(msg);

    setTimeout(async () => {
      startDeepCodeCommand();
    }, 5000);
  }

  public async processError(
    extension: DeepCode.ExtensionInterface | any,
    error: DeepCode.errorType,
    options: { [key: string]: any } = {}
  ): Promise<void> {
    const {
      unauthorizedUser,
      unauthorizedContent,
      unauthorizedBundleAccess,
      notFound,
      serverError,
      badGateway,
      serviceUnavailable,
      timeout
    } = statusCodes;
    await this.sendErrorToServer(extension, error, options);

    if (error.error) {
      const {code, message } = error.error;
      // TODO: move it to 'tsc'
      if (code === "ENOTFOUND" && message === 'getaddrinfo ENOTFOUND www.deepcode.ai') {
        return this.serverErrorHandler(extension);
      }
    }

    if (error.errno) {
      return this.systemError(error);
    }

    switch (error.statusCode) {
      case unauthorizedUser:
        return this.unauthorizedAccess(extension);
      case notFound:
        return this.unauthorizedAccess(extension);
      case unauthorizedContent:
      case unauthorizedBundleAccess:
      case serverError:
      case badGateway:
      case serviceUnavailable:
      case timeout:
        return this.serverErrorHandler(extension);
      default:
        return this.generalError();
    }
  }

  private async sendErrorToServer(
    extension: DeepCode.ExtensionInterface,
    error: DeepCode.errorType,
    options: { [key: string]: any }
  ): Promise<void> {
    await extension.sendError(
      {
        type: `${error.statusCode || ""} ${error.name || ""}`.trim(),
        message: options.message || errorsLogs.undefinedError,
        ...(options.endpoint && { path: options.endpoint }),
        ...(options.bundleId && { bundleId: options.bundleId }),
        data: {
          errorTrace: JSON.stringify(error),
          ...options.data
        }
      }
    );
  }

  private async unauthorizedAccess(extension: DeepCode.ExtensionInterface): Promise<void> {
    await sleep(1000);
    await extension.activateExtensionAnalyzeActions();
  }

}

export default DeepCodeErrorHandler;
