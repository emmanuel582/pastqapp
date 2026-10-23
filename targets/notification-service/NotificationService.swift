import Foundation
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
    private let lock = NSLock()
    private var handler: ((UNNotificationContent) -> Void)?
    private var fallback: UNNotificationContent?
    private var task: URLSessionDownloadTask?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        handler = contentHandler
        fallback = request.content
        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent,
              let body = request.content.userInfo["body"] as? [String: Any],
              let rich = body["_richContent"] as? [String: Any],
              let image = rich["image"] as? String,
              let url = URL(string: image), url.scheme == "https" else {
            finish(request.content)
            return
        }
        var download = URLRequest(url: url)
        download.timeoutInterval = 18
        task = URLSession.shared.downloadTask(with: download) { [weak self] file, response, error in
            guard let self else { return }
            guard error == nil, let file,
                  let response = response as? HTTPURLResponse, response.statusCode == 200,
                  response.mimeType == "image/jpeg",
                  let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize,
                  size > 0, size <= 5 * 1024 * 1024 else {
                self.finish(content)
                return
            }
            do {
                let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                let imageFile = folder.appendingPathComponent("announcement.jpg")
                try FileManager.default.moveItem(at: file, to: imageFile)
                content.attachments = [try UNNotificationAttachment(identifier: "artwork", url: imageFile, options: nil)]
            } catch {
                // Text remains deliverable if an image cannot be downloaded or attached.
            }
            self.finish(content)
        }
        task?.resume()
    }

    private func finish(_ content: UNNotificationContent) {
        lock.lock()
        let completion = handler
        handler = nil
        lock.unlock()
        completion?(content)
    }

    override func serviceExtensionTimeWillExpire() {
        task?.cancel()
        if let fallback { finish(fallback) }
    }
}
